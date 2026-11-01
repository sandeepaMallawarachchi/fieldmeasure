#!/bin/sh
# Regenerates the favicon and PWA icons from public/logo.png. Needs ImageMagick.
# The icons use only the pin-and-field mark, because the wordmark is unreadable
# at icon sizes. Run from the repository root after changing the logo.
set -e

LOGO=public/logo.png
OUT=public/icons
MARK="$(mktemp -d)/mark.png"
mkdir -p "$OUT"

# The app shows the logo small, so it loads this lighter copy rather than the source.
magick "$LOGO" -resize 720x -strip -define png:compression-level=9 "$OUT/logo-header.png"

# The mark occupies the left of the logo; the wordmark starts at about x=558.
magick "$LOGO" -crop 540x724+0+0 +repage -trim +repage "$MARK"

# icon <size> <mark size> <output>: the mark centred on an opaque white square.
icon() {
  magick -size "$1x$1" xc:white \
    \( "$MARK" -resize "$2x$2" \) -gravity center -composite \
    -alpha off -strip "$3"
}

icon 192 160 "$OUT/icon-192.png"
icon 512 428 "$OUT/icon-512.png"
icon 180 148 "$OUT/apple-touch-icon.png"
# Maskable icons can be cropped to a circle: the mark stays inside the central 80% safe zone.
icon 512 330 "$OUT/icon-maskable-512.png"

FAVICON_DIR="$(dirname "$MARK")"
icon 16 15 "$FAVICON_DIR/16.png"
icon 32 30 "$FAVICON_DIR/32.png"
icon 48 45 "$FAVICON_DIR/48.png"
magick "$FAVICON_DIR/16.png" "$FAVICON_DIR/32.png" "$FAVICON_DIR/48.png" app/favicon.ico
