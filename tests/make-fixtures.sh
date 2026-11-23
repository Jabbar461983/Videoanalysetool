#!/usr/bin/env bash
# Erzeugt kurze Testvideos (nicht eingecheckt). Braucht ffmpeg.
set -euo pipefail
mkdir -p "$(dirname "$0")/fixtures"
cd "$(dirname "$0")/fixtures"
SRC="testsrc2=size=640x360:rate=25:duration=12"
AUD="sine=frequency=440:duration=12"
[ -f test-vp9.webm ] || ffmpeg -loglevel error -y -f lavfi -i "$SRC" -f lavfi -i "$AUD" -c:v libvpx-vp9 -b:v 300k -g 25 -c:a libopus -shortest test-vp9.webm
[ -f test-h264.mp4 ] || ffmpeg -loglevel error -y -f lavfi -i "$SRC" -f lavfi -i "$AUD" -c:v libx264 -g 25 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart test-h264.mp4
# Grüner Boden mit roter «Figur» für den Spieler-Test (Etappe 7)
[ -f spieler-vp9.webm ] || ffmpeg -loglevel error -y -f lavfi -i "color=c=0x2e6b34:s=640x360:r=25:d=6,noise=alls=12:allf=t+u,drawbox=x=300:y=110:w=44:h=130:color=0xd62828:t=fill,drawbox=x=308:y=84:w=28:h=28:color=0xf1c27d:t=fill,drawbox=x=0:y=300:w=640:h=4:color=white:t=fill" -c:v libvpx-vp9 -b:v 500k spieler-vp9.webm
echo ok
