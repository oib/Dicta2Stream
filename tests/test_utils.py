"""Tests for utility modules: log, range_response, convert_to_opus, concat_opus."""

import os
import pytest
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock


# ============================================================
# Tests for log.py
# ============================================================

class TestLogViolation:
    """Tests for the log_violation function."""

    def test_log_violation_creates_file(self, tmp_path):
        """Test that log_violation creates the log file and writes an entry."""
        from src.backend.log import log_violation

        log_dir = tmp_path / "log"
        log_dir.mkdir()

        with patch("src.backend.log.os.path.dirname", return_value=str(tmp_path / "src" / "backend")):
            # os.path.join will naturally produce tmp_path/log and tmp_path/log/abuse.log
            log_violation("TEST_EVENT", "127.0.0.1", "testuid", "test reason")

        log_file = log_dir / "abuse.log"
        assert log_file.exists()
        content = log_file.read_text()
        assert "TEST_EVENT" in content
        assert "127.0.0.1" in content
        assert "testuid" in content
        assert "test reason" in content

    def test_log_violation_format(self, tmp_path):
        """Test that log entries follow the expected format."""
        from src.backend.log import log_violation

        log_dir = tmp_path / "log"
        log_dir.mkdir()

        with patch("src.backend.log.os.path.dirname", return_value=str(tmp_path / "src" / "backend")):
            log_violation("UPLOAD", "10.0.0.1", "user@test.com", "File too large")

        content = (log_dir / "abuse.log").read_text()
        assert "IP=10.0.0.1" in content
        assert "UID=user@test.com" in content
        assert "REASON=File too large" in content

    def test_log_violation_appends(self, tmp_path):
        """Test that multiple log entries are appended, not overwritten."""
        from src.backend.log import log_violation

        log_dir = tmp_path / "log"
        log_dir.mkdir()

        with patch("src.backend.log.os.path.dirname", return_value=str(tmp_path / "src" / "backend")):
            log_violation("EVENT_1", "1.1.1.1", "uid1", "reason1")
            log_violation("EVENT_2", "2.2.2.2", "uid2", "reason2")

        lines = (log_dir / "abuse.log").read_text().strip().split("\n")
        assert len(lines) == 2
        assert "EVENT_1" in lines[0]
        assert "EVENT_2" in lines[1]


# ============================================================
# Tests for range_response.py
# ============================================================

class TestParseRangeHeader:
    """Tests for the parse_range_header function."""

    def test_no_range_header(self):
        from src.backend.range_response import parse_range_header
        assert parse_range_header(None, 1000) is None

    def test_invalid_prefix(self):
        from src.backend.range_response import parse_range_header
        assert parse_range_header("invalid=0-100", 1000) is None

    def test_valid_range(self):
        from src.backend.range_response import parse_range_header
        result = parse_range_header("bytes=0-499", 1000)
        assert result == (0, 499)

    def test_range_from_start(self):
        from src.backend.range_response import parse_range_header
        result = parse_range_header("bytes=0-", 1000)
        assert result == (0, 999)

    def test_range_partial(self):
        from src.backend.range_response import parse_range_header
        result = parse_range_header("bytes=500-999", 1000)
        assert result == (500, 999)

    def test_range_exceeds_file_size(self):
        from src.backend.range_response import parse_range_header
        result = parse_range_header("bytes=0-2000", 1000)
        assert result is None

    def test_range_start_after_end(self):
        from src.backend.range_response import parse_range_header
        result = parse_range_header("bytes=500-100", 1000)
        assert result is None

    def test_range_non_numeric(self):
        from src.backend.range_response import parse_range_header
        result = parse_range_header("bytes=abc-def", 1000)
        assert result is None


class TestFileStreamGenerator:
    """Tests for the file_stream_generator function."""

    def test_stream_full_file(self, tmp_path):
        from src.backend.range_response import file_stream_generator

        test_file = tmp_path / "test.bin"
        test_data = b"Hello, World! This is test data."
        test_file.write_bytes(test_data)

        chunks = list(file_stream_generator(str(test_file), 0, len(test_data) - 1))
        result = b"".join(chunks)
        assert result == test_data

    def test_stream_partial_range(self, tmp_path):
        from src.backend.range_response import file_stream_generator

        test_file = tmp_path / "test.bin"
        test_data = b"0123456789ABCDEF"
        test_file.write_bytes(test_data)

        chunks = list(file_stream_generator(str(test_file), 4, 9))
        result = b"".join(chunks)
        assert result == b"456789"

    def test_stream_single_byte(self, tmp_path):
        from src.backend.range_response import file_stream_generator

        test_file = tmp_path / "test.bin"
        test_file.write_bytes(b"ABCDEF")

        chunks = list(file_stream_generator(str(test_file), 2, 2))
        result = b"".join(chunks)
        assert result == b"C"


class TestRangeResponse:
    """Tests for the range_response function."""

    def test_full_response_without_range(self, tmp_path):
        from src.backend.range_response import range_response

        test_file = tmp_path / "audio.opus"
        test_data = b"fake audio data " * 100
        test_file.write_bytes(test_data)

        mock_request = MagicMock()
        mock_request.headers.get.return_value = None

        response = range_response(mock_request, str(test_file))
        assert response.status_code == 200
        assert response.headers.get("Accept-Ranges") == "bytes"

    def test_partial_response_with_range(self, tmp_path):
        from src.backend.range_response import range_response

        test_file = tmp_path / "audio.opus"
        test_data = b"fake audio data " * 100
        test_file.write_bytes(test_data)

        mock_request = MagicMock()
        mock_request.headers.get.return_value = "bytes=0-99"

        response = range_response(mock_request, str(test_file))
        assert response.status_code == 206
        assert "Content-Range" in response.headers


# ============================================================
# Tests for convert_to_opus.py
# ============================================================

class TestConvertToOpus:
    """Tests for the convert_to_opus function."""

    def test_input_file_not_found(self):
        from src.backend.convert_to_opus import convert_to_opus

        with pytest.raises(FileNotFoundError):
            convert_to_opus("/nonexistent/file.mp3", "/tmp/out.opus")

    def test_ffmpeg_command_structure(self, tmp_path):
        """Test that the ffmpeg command is constructed correctly."""
        from src.backend.convert_to_opus import convert_to_opus

        input_file = tmp_path / "input.mp3"
        input_file.write_bytes(b"fake mp3 data")
        output_file = tmp_path / "output.opus"

        with patch("src.backend.convert_to_opus.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            # Create the output file to simulate ffmpeg success
            output_file.write_bytes(b"fake opus data")

            result = convert_to_opus(str(input_file), str(output_file))

            # Verify ffmpeg was called
            mock_run.assert_called_once()
            cmd = mock_run.call_args[0][0]
            assert cmd[0] == "ffmpeg"
            assert "-y" in cmd
            assert str(input_file) in cmd
            assert str(output_file) in cmd
            assert "libopus" in cmd

    def test_ffmpeg_failure_raises_error(self, tmp_path):
        """Test that ffmpeg failure raises RuntimeError."""
        import subprocess
        from src.backend.convert_to_opus import convert_to_opus

        input_file = tmp_path / "input.mp3"
        input_file.write_bytes(b"fake mp3 data")
        output_file = tmp_path / "output.opus"

        with patch("src.backend.convert_to_opus.subprocess.run") as mock_run:
            mock_run.side_effect = subprocess.CalledProcessError(1, "ffmpeg")

            with pytest.raises(RuntimeError, match="FFmpeg conversion failed"):
                convert_to_opus(str(input_file), str(output_file))

    def test_missing_output_raises_error(self, tmp_path):
        """Test that missing output after ffmpeg raises RuntimeError."""
        from src.backend.convert_to_opus import convert_to_opus

        input_file = tmp_path / "input.mp3"
        input_file.write_bytes(b"fake mp3 data")
        output_file = tmp_path / "output.opus"

        with patch("src.backend.convert_to_opus.subprocess.run"):
            # Don't create output file — simulates ffmpeg producing nothing
            with pytest.raises(RuntimeError, match="did not produce output"):
                convert_to_opus(str(input_file), str(output_file))

    def test_audio_filters_applied(self, tmp_path):
        """Test that audio filters (highpass, lowpass, compressor, etc.) are in the command."""
        from src.backend.convert_to_opus import convert_to_opus

        input_file = tmp_path / "input.mp3"
        input_file.write_bytes(b"fake mp3 data")
        output_file = tmp_path / "output.opus"

        with patch("src.backend.convert_to_opus.subprocess.run") as mock_run:
            output_file.write_bytes(b"fake opus")
            convert_to_opus(str(input_file), str(output_file))

            cmd = mock_run.call_args[0][0]
            af_index = cmd.index("-af")
            filters_str = cmd[af_index + 1]
            assert "highpass" in filters_str
            assert "lowpass" in filters_str
            assert "acompressor" in filters_str
            assert "alimiter" in filters_str
            assert "agate" in filters_str


# ============================================================
# Tests for concat_opus.py
# ============================================================

class TestConcatOpus:
    """Tests for the concat_opus_files function."""

    def test_no_opus_files_creates_empty_output(self, tmp_path):
        """Test that an empty directory produces an empty stream.opus."""
        import src.backend.concat_opus as concat_mod
        from src.backend.concat_opus import concat_opus_files

        output_file = tmp_path / "stream.opus"
        original = concat_mod.log_violation
        concat_mod.log_violation = MagicMock()
        try:
            concat_opus_files(tmp_path, output_file)
        finally:
            concat_mod.log_violation = original

        assert output_file.exists()
        assert output_file.stat().st_size == 0

    def test_stream_opus_excluded(self, tmp_path):
        """Test that stream.opus itself is excluded from concatenation."""
        import src.backend.concat_opus as concat_mod
        from src.backend.concat_opus import concat_opus_files

        (tmp_path / "stream.opus").write_bytes(b"existing stream")
        output_file = tmp_path / "stream.opus"

        original = concat_mod.log_violation
        concat_mod.log_violation = MagicMock()
        try:
            concat_opus_files(tmp_path, output_file)
        finally:
            concat_mod.log_violation = original

        assert output_file.stat().st_size == 0

    def test_duplicate_files_detected(self, tmp_path):
        """Test that duplicate files (same content) are detected and removed."""
        import src.backend.concat_opus as concat_mod
        from src.backend.concat_opus import concat_opus_files

        (tmp_path / "file1.opus").write_bytes(b"identical content here")
        (tmp_path / "file2.opus").write_bytes(b"identical content here")
        output_file = tmp_path / "stream.opus"

        mock_log = MagicMock()
        original = concat_mod.log_violation
        concat_mod.log_violation = mock_log
        try:
            with patch("src.backend.concat_opus.subprocess.run"):
                output_file.write_bytes(b"concatenated")
                concat_opus_files(tmp_path, output_file)
        finally:
            concat_mod.log_violation = original

        duplicate_calls = [
            c for c in mock_log.call_args_list
            if c[0][0] == "CONCAT_DUPLICATE"
        ]
        assert len(duplicate_calls) == 1

    def test_filelist_cleaned_up(self, tmp_path):
        """Test that filelist.txt is cleaned up after concatenation."""
        import src.backend.concat_opus as concat_mod
        from src.backend.concat_opus import concat_opus_files

        (tmp_path / "audio1.opus").write_bytes(b"audio data 1")
        output_file = tmp_path / "stream.opus"

        original = concat_mod.log_violation
        concat_mod.log_violation = MagicMock()
        try:
            with patch("src.backend.concat_opus.subprocess.run"):
                output_file.write_bytes(b"result")
                concat_opus_files(tmp_path, output_file)
        finally:
            concat_mod.log_violation = original

        filelist = tmp_path / "filelist.txt"
        assert not filelist.exists()

    def test_ffmpeg_failure_raises(self, tmp_path):
        """Test that ffmpeg concat failure raises RuntimeError."""
        import subprocess
        import src.backend.concat_opus as concat_mod
        from src.backend.concat_opus import concat_opus_files

        (tmp_path / "audio1.opus").write_bytes(b"audio data")
        output_file = tmp_path / "stream.opus"

        original = concat_mod.log_violation
        concat_mod.log_violation = MagicMock()
        try:
            with patch("src.backend.concat_opus.subprocess.run") as mock_run:
                mock_run.side_effect = subprocess.CalledProcessError(1, "ffmpeg")
                with pytest.raises(RuntimeError, match="FFmpeg concat failed"):
                    concat_opus_files(tmp_path, output_file)
        finally:
            concat_mod.log_violation = original
