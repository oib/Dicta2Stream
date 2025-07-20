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
    # Clean up any existing filelist.txt to prevent issues
    filelist_path = user_dir / 'filelist.txt'
    if filelist_path.exists():
        try:
            filelist_path.unlink()
        except Exception as e:
            print(f"Warning: Could not clean up old filelist.txt: {e}")
    
    # Get all opus files except stream.opus and remove any duplicates
    import hashlib
    file_hashes = set()
    files = []
    
    for f in user_dir.glob('*.opus'):
        if f.name == 'stream.opus':
            continue
            
        try:
            # Calculate file hash for duplicate detection
            hasher = hashlib.md5()
            with open(f, 'rb') as file:
                buf = file.read(65536)  # Read in 64kb chunks
                while len(buf) > 0:
                    hasher.update(buf)
                    buf = file.read(65536)
            file_hash = hasher.hexdigest()
            
            # Skip if we've seen this exact file before
            if file_hash in file_hashes:
                print(f"Removing duplicate file: {f.name}")
                f.unlink()
                continue
                
            file_hashes.add(file_hash)
            files.append(f)
            
        except Exception as e:
            print(f"Error processing {f}: {e}")
    
    if not files:
        # If no files, create an empty stream.opus
        output_file.write_bytes(b'')
        return output_file
        
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
