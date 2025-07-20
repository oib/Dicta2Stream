#!/usr/bin/env python3
"""
Create a silent OPUS audio file with 1 second of silence.
"""
import os
import opuslib
import numpy as np
import struct

# Configuration
SAMPLE_RATE = 48000
CHANNELS = 1
FRAME_SIZE = 960  # 20ms at 48kHz
SILENCE_DURATION = 1.0  # seconds
OUTPUT_FILE = "silent.opus"

# Calculate number of frames needed
num_frames = int((SAMPLE_RATE * SILENCE_DURATION) / (FRAME_SIZE * CHANNELS))

# Initialize Opus encoder
enc = opuslib.Encoder(SAMPLE_RATE, CHANNELS, 'voip')

# Create silent audio data (all zeros)
silent_frame = struct.pack('h' * FRAME_SIZE * CHANNELS, *([0] * FRAME_SIZE * CHANNELS))

# Create Ogg Opus file
with open(OUTPUT_FILE, 'wb') as f:
    # Write Ogg header
    f.write(b'OggS')  # Magic number
    f.write(b'\x00')  # Version
    f.write(b'\x00')  # Header type (0 = normal)
    f.write(b'\x00\x00\x00\x00\x00\x00\x00\x00')  # Granule position
    f.write(b'\x00\x00\x00\x00')  # Bitstream serial number
    f.write(b'\x00\x00\x00\x00')  # Page sequence number
    f.write(b'\x00\x00\x00\x00')  # Checksum
    f.write(b'\x01')  # Number of segments
    f.write(b'\x00')  # Segment table (0 = 1 byte segment)
    
    # Write Opus header
    f.write(b'OpusHead')  # Magic signature
    f.write(b'\x01')  # Version
    f.write(chr(CHANNELS).encode('latin1'))  # Channel count
    f.write(struct.pack('<H', 80))  # Preskip (80 samples)
    f.write(struct.pack('<I', SAMPLE_RATE))  # Input sample rate
    f.write(b'\x00\x00')  # Output gain
    f.write(b'\x00')  # Channel mapping family (0 = mono/stereo)
    
    # Write comment header
    f.write(b'OpusTags')  # Magic signature
    f.write(struct.pack('<I', 0))  # Vendor string length (0 for none)
    f.write(struct.pack('<I', 0))  # Number of comments (0)
    
    # Encode and write silent frames
    for _ in range(num_frames):
        # Encode the silent frame
        encoded = enc.encode(silent_frame, FRAME_SIZE)
        
        # Write Ogg page
        f.write(b'OggS')  # Magic number
        f.write(b'\x00')  # Version
        f.write(b'\x00')  # Header type (0 = normal)
        f.write(struct.pack('<Q', (FRAME_SIZE * _) % (1 << 64)))  # Granule position
        f.write(b'\x00\x00\x00\x00')  # Bitstream serial number
        f.write(struct.pack('<I', _ + 2))  # Page sequence number
        f.write(b'\x00\x00\x00\x00')  # Checksum (0 for now)
        f.write(b'\x01')  # Number of segments
        f.write(chr(len(encoded)).encode('latin1'))  # Segment length
        f.write(encoded)  # The encoded data

print(f"Created silent OPUS file: {OUTPUT_FILE}")
