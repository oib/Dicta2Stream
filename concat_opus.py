# concat_opus.py — Concatenate all opus files in a user directory in random order into a single stream.opus
import os
import random
import subprocess
from pathlib import Path

def concat_opus_files(user_dir: Path, output_file: Path):
    """
    Concatenate all .opus files in user_dir (except stream.opus) in random order into output_file.
    Overwrites output_file if exists. Creates it if missing.
    """
    files = [f for f in user_dir.glob('*.opus') if f.name != 'stream.opus']
    if not files:
        raise FileNotFoundError(f"No opus files to concatenate in {user_dir}")
    random.shuffle(files)
    
    # Create a filelist for ffmpeg concat
    filelist_path = user_dir / 'filelist.txt'
    with open(filelist_path, 'w') as f:
        for opusfile in files:
            f.write(f"file '{opusfile.resolve()}'\n")
    
    # ffmpeg concat demuxer (no re-encoding)
    cmd = [
        'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(filelist_path),
        '-c', 'copy', str(output_file)
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg concat failed: {e}")
    finally:
        if filelist_path.exists():
            filelist_path.unlink()
    if not output_file.exists():
        raise RuntimeError("Concatenation did not produce output.")
    return output_file
