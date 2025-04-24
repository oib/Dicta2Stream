# convert_to_opus.py — Default voice pipeline: bandpass + compressor + limiter + gate

import subprocess
import os

def convert_to_opus(input_path, output_path):
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    filters = [
        "highpass=f=400",             # low-cut below 400 Hz
        "lowpass=f=12000",            # high-cut above 12 kHz
        "acompressor=threshold=-18dB",
        "alimiter=limit=-1dB",
        "agate=threshold=0.02"
    ]

    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-af", ",".join(filters),
        "-ac", "1",
        "-ar", "24000",
        "-c:a", "libopus",
        "-b:a", "40k",
        "-vbr", "on",
        "-application", "voip",
        output_path
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg conversion failed: {e}")

    if not os.path.exists(output_path):
        raise RuntimeError("Conversion did not produce output.")

    return output_path
