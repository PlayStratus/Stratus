#!/usr/bin/env sh

# Usage: ./build-supertuxkart.sh [<app-image-path>]

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
SYS_DIR="$APPDIR/supertuxkart"
mkdir --parents "$BIN_DIR" "$SYS_DIR"

# Download and extract files
ZIP="$BUILD_DIR/stk.zip"
UNZIP="$BUILD_DIR/stk"
wget https://github.com/supertuxkart/stk-code/releases/download/1.5/SuperTuxKart-1.5-win.zip -O "$ZIP"
unzip -q "$ZIP" 'SuperTuxKart-1.5-win/stk-code/build-x86_64/*' \
    'SuperTuxKart-1.5-win/stk-code/data/*' -d "$UNZIP"
mv "$UNZIP/SuperTuxKart-1.5-win/stk-code/build-x86_64/bin" "$SYS_DIR"
mv "$UNZIP/SuperTuxKart-1.5-win/stk-code/data" "$SYS_DIR"

# Add run scripts
CONFIG_DIR='~/.wine/drive_c/users/$(whoami)/AppData/Roaming/supertuxkart/config-0.10'
cat << EOF > "$BIN_DIR/supertuxkart-stage-1"
#!/usr/bin/sh

stratus-launcher usr/bin/supertuxkart-stage-2
EOF
cat << EOF > "$BIN_DIR/supertuxkart-stage-2"
#!/usr/bin/sh

mkdir --parents $CONFIG_DIR
cp supertuxkart/players.xml $CONFIG_DIR/players.xml

DISPLAY= wine supertuxkart/bin/supertuxkart.exe --use-gamepad=0 \
    --fullscreen --screensize=\${STRATUS_DIMENSIONS:-640x480} \
    --track=sandtrack --no-start-screen --unlock-all --laps=1
EOF
chmod +x "$BIN_DIR/supertuxkart-stage-1" "$BIN_DIR/supertuxkart-stage-2"

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

# Create player config file to disable tutorial popup
cat << EOF > $SYS_DIR/players.xml
<?xml version="1.0"?>
<players version="1" >
    <current player="stratus"/>
    <player name="stratus" guest="false" use-frequency="1">
    </player>
</players>
EOF

# Create additional required symlinks
ln -sr "$SYS_DIR/data/supertuxkart_256.png" \
    "$APPDIR/io.playstratus.supertuxkart.png"
ln -sr "$APPDIR/io.playstratus.supertuxkart.png" "$APPDIR/.DirIcon"
ln -sr "$BIN_DIR/supertuxkart-stage-1" "$APPDIR/AppRun"

# Build appimage
DEFAULT_DEST="$(dirname "$0")/build/supertuxkart"
ARCH=x86_64 appimagetool "$APPDIR" "${1:-$DEFAULT_DEST}"
