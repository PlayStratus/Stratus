#!/usr/bin/env sh

# Usage: ./supertuxkart.sh [<app-image-path>]

# This script creates a AppImage for SuperTuxKart that uses stratus-launcher.
# Even though SuperTuxKart runs natively on Linux, we use the Windows version to
# test support for running games through wine.

set -e

# Create temporary build directory
BUILD_DIR=$(mktemp -d -p /tmp stratus-game-build-XXXXXX)
cleanup() {
    [ -d "$BUILD_DIR" ] && rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

# Create directories
APPDIR="$BUILD_DIR/AppDir"
BIN_DIR="$APPDIR/usr/bin"
SYS_DIR="$APPDIR/c/supertuxkart"
CONFIG_DIR="$APPDIR/home/AppData/Roaming/supertuxkart/config-0.10"
mkdir --parents "$BIN_DIR" "$SYS_DIR" "$CONFIG_DIR"

# Download and extract files
ZIP="$BUILD_DIR/stk.zip"
UNZIP="$BUILD_DIR/stk"
wget https://github.com/supertuxkart/stk-code/releases/download/1.5/SuperTuxKart-1.5-win.zip -O "$ZIP"
unzip -q "$ZIP" 'SuperTuxKart-1.5-win/stk-code/build-x86_64/*' \
    'SuperTuxKart-1.5-win/stk-code/data/*' -d "$UNZIP"
mv "$UNZIP/SuperTuxKart-1.5-win/stk-code/build-x86_64/bin" "$SYS_DIR"
mv "$UNZIP/SuperTuxKart-1.5-win/stk-code/data" "$SYS_DIR"

# Add run script
cat << EOF > "$BIN_DIR/supertuxkart"
#!/usr/bin/sh

DISPLAY= stratus-launcher wine supertuxkart/bin/supertuxkart.exe --fullscreen \
    --track=sandtrack --no-start-screen
EOF
chmod +x "$BIN_DIR/supertuxkart"

# Add desktop file
cat << EOF > "$APPDIR/io.playstratus.supertuxkart.desktop"
[Desktop Entry]
X-AppImage-Arch=x86_64
X-AppImage-Version=1.5.0
X-AppImage-Name=SuperTuxKart
Type=Application
Name=SuperTuxKart
Exec=/usr/bin/supertuxkart
Categories=Game
Icon=io.playstratus.supertuxkart
EOF

# Create additional required symlinks
ln -sr "$SYS_DIR/data/supertuxkart_256.png" \
    "$APPDIR/io.playstratus.supertuxkart.png"
ln -sr "$APPDIR/io.playstratus.supertuxkart.png" "$APPDIR/.DirIcon"
ln -sr "$BIN_DIR/supertuxkart" "$APPDIR/AppRun"

# Build appimage
ARCH=x86_64 appimagetool "$APPDIR" "${1:-supertuxkart.AppImage}"
