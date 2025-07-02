#!/bin/bash

# Create a 1-second silent audio file in Opus format
ffmpeg -f lavfi -i anullsrc=r=48000:cl=mono -t 1 -c:a libopus -b:a 60k /home/oib/games/dicta2stream/static/test-audio.opus

# Verify the file was created
if [ -f "/home/oib/games/dicta2stream/static/test-audio.opus" ]; then
    echo "Test audio file created successfully at /home/oib/games/dicta2stream/static/test-audio.opus"
    echo "File size: $(du -h /home/oib/games/dicta2stream/static/test-audio.opus | cut -f1)"
else
    echo "Failed to create test audio file"
    exit 1
fi
