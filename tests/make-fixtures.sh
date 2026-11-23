#!/usr/bin/env bash
# Erzeugt kurze Testvideos (nicht eingecheckt). Braucht ffmpeg.
set -euo pipefail
mkdir -p "$(dirname "$0")/fixtures"
cd "$(dirname "$0")/fixtures"
SRC="testsrc2=size=640x360:rate=25:duration=12"
AUD="sine=frequency=440:duration=12"
[ -f test-vp9.webm ] || ffmpeg -loglevel error -y -f lavfi -i "$SRC" -f lavfi -i "$AUD" -c:v libvpx-vp9 -b:v 300k -g 25 -c:a libopus -shortest test-vp9.webm
[ -f test-h264.mp4 ] || ffmpeg -loglevel error -y -f lavfi -i "$SRC" -f lavfi -i "$AUD" -c:v libx264 -g 25 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart test-h264.mp4
echo ok
