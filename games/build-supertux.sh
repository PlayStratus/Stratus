#!/usr/bin/env sh

# Usage: ./build-supertux.sh [<app-image-path>]

# This script creates a AppImage for SuperTux that uses stratus-launcher. Even
# though SuperTux runs natively on Linux, we use the Windows version to test
# support for running games through wine.

set -e

# Create temporary build directory
BUILD_DIR=$(mktemp -d -p /tmp stratus-game-build-XXXXXX)
cleanup() {
    [ -d $BUILD_DIR ] && rm -rf $BUILD_DIR
}
trap cleanup EXIT

# Create directories
APPDIR=$BUILD_DIR/AppDir
BIN_DIR=$APPDIR/usr/bin
SYS_DIR=$APPDIR/supertux
mkdir --parents $BIN_DIR $SYS_DIR

# Download and extract files
ZIP=$BUILD_DIR/st.zip
UNZIP=$BUILD_DIR/st
wget https://github.com/SuperTux/supertux/releases/download/v0.7.0/SuperTux-v0.7.0-win64-portable.zip -O $ZIP
unzip -q $ZIP -d $UNZIP
mv $UNZIP/SuperTux-portable/* $SYS_DIR

# Add run scripts
CONFIG_DIR='~/.wine/drive_c/users/$(whoami)/AppData/Roaming/SuperTux/supertux2'
cat << EOF > "$BIN_DIR/supertux-stage-1"
#!/usr/bin/sh

stratus-launcher usr/bin/supertux-stage-2
EOF
cat << EOF > "$BIN_DIR/supertux-stage-2"
#!/usr/bin/sh

mkdir --parents $CONFIG_DIR
cp supertux/config $CONFIG_DIR/config

DISPLAY= wine supertux/bin/supertux2.exe \
        --fullscreen --geometry \${STRATUS_DIMENSIONS:-640x480}
EOF
chmod +x $BIN_DIR/supertux-stage-1 $BIN_DIR/supertux-stage-2

# Add desktop file
cat << EOF > $APPDIR/io.playstratus.supertux.desktop
[Desktop Entry]
X-AppImage-Arch=x86_64
X-AppImage-Version=0.7.0
X-AppImage-Name=SuperTux
Type=Application
Name=SuperTux
Exec=/usr/bin/supertux
Categories=Game
Icon=io.playstratus.supertux
EOF

# Create config file to disable internet popup
cat << EOF > $SYS_DIR/config
(supertux-config
  (disable_network #t)
)
EOF

# Create additional required symlinks
ln -sr $SYS_DIR/supertux.png \
    $APPDIR/io.playstratus.supertux.png
ln -sr $APPDIR/io.playstratus.supertux.png $APPDIR/.DirIcon
ln -sr $BIN_DIR/supertux-stage-1 $APPDIR/AppRun

# Build appimage
DEFAULT_DEST="$(dirname "$0")/build/supertux"
ARCH=x86_64 appimagetool $APPDIR "${1:-$DEFAULT_DEST}"
