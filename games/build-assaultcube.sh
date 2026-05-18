#!/usr/bin/env sh

# Usage: ./build-assaultcube.sh [<app-image-path>]

# This script creates an AppImage for AssaultCube that uses stratus-launcher.

# KEYBINDINGS:
#
#   Left Stick          Arrow keys              Movement & menu navigation
#   Right Stick         Mouse                   Movement
#   Right Stick Click   Shift                   Crouch
#   Left trigger        Right mouse button      Special attack
#   Right trigger       Left mouse button       Attack
#   A                   Space                   Jump & menu navigation
#   X                   R                       Reload
#   Start               Escape                  Menu navigation

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
SYS_DIR=$APPDIR/assaultcube
mkdir --parents $BIN_DIR $SYS_DIR

# Download and extract files
ZIP=$BUILD_DIR/ac.zip
UNZIP=$BUILD_DIR/ac
cp "$(dirname $0)/assaultcube-1.3.0.2-portable.zip" $ZIP
unzip -q $ZIP -d $UNZIP
mv $UNZIP/AssaultCube\ 1.3.0.2/* $SYS_DIR
mv $UNZIP/windows/system32/OpenAL32.dll $SYS_DIR/bin_win32/OpenAL32.dll
mv $UNZIP/windows/system32/wrap_oal.dll $SYS_DIR/bin_win32/wrap_oal.dll
mv $UNZIP/windows/syswow64/OpenAL32.dll $SYS_DIR/bin_win32/OpenAL32_64.dll
mv $UNZIP/windows/syswow64/wrap_oal.dll $SYS_DIR/bin_win32/wrap_oal_64.dll

# Add run scripts
cat << EOF > "$BIN_DIR/assaultcube-stage-1"
#!/usr/bin/sh
stratus-launcher --amx-profile assaultcube/assaultcube.amgp \
    usr/bin/assaultcube-stage-2
EOF
CONF_DIR='$HOME/.wine/drive_c/users/$(whoami)/ac/config'
cat << EOF > "$BIN_DIR/assaultcube-stage-2"
#!/usr/bin/sh
mkdir --parents $CONF_DIR
echo name Stratus >> $CONF_DIR/saved.cfg
echo alias __firstrun 1 >> $CONF_DIR/saved.cfg

cd assaultcube
mkdir --parents "$HOME/.wine/drive_c/Program Files (x86)/OpenAL"
cp bin_win32/OpenAL32.dll ~/.wine/drive_c/windows/system32/OpenAL32.dll
cp bin_win32/wrap_oal.dll ~/.wine/drive_c/windows/system32/wrap_oal.dll
cp bin_win32/OpenAL32_64.dll ~/.wine/drive_c/windows/syswow64/OpenAL32.dll
cp bin_win32/wrap_oal_64.dll ~/.wine/drive_c/windows/syswow64/wrap_oal.dll
cp bin_win32/oalinst.exe "$HOME/.wine/drive_c/Program Files (x86)/OpenAL/oalinst.exe"

DISPLAY= wine bin_win32/ac_client.exe --home="C:/users/\$(whoami)/ac"
EOF
chmod +x "$BIN_DIR/assaultcube-stage-1" "$BIN_DIR/assaultcube-stage-2"

# Add controller-keyboard mappings
cat << EOF > $SYS_DIR/assaultcube.amgp
<?xml version="1.0" encoding="UTF-8"?>
<gamecontroller configversion="19" appversion="3.6.0">
    <profilename>AssaultCube</profilename>
    <stickAxisAssociation index="1" xAxis="1" yAxis="2"/>
    <stickAxisAssociation index="2" xAxis="3" yAxis="4"/>
    <vdpadButtonAssociations index="1">
        <vdpadButtonAssociation axis="0" button="12" direction="1"/>
        <vdpadButtonAssociation axis="0" button="13" direction="4"/>
        <vdpadButtonAssociation axis="0" button="14" direction="8"/>
        <vdpadButtonAssociation axis="0" button="15" direction="2"/>
    </vdpadButtonAssociations>
    <names>
        <controlstickname index="1">Stick 1</controlstickname>
        <controlstickname index="2">Stick 2</controlstickname>
    </names>
    <sets>
        <set index="1">
            <stick index="1">
                <stickbutton index="3">
                    <slots>
                        <slot>
                            <code>0x1000014</code>
                            <mode>keyboard</mode>
                        </slot>
                    </slots>
                </stickbutton>
                <stickbutton index="5">
                    <slots>
                        <slot>
                            <code>0x1000015</code>
                            <mode>keyboard</mode>
                        </slot>
                    </slots>
                </stickbutton>
                <stickbutton index="7">
                    <slots>
                        <slot>
                            <code>0x1000012</code>
                            <mode>keyboard</mode>
                        </slot>
                    </slots>
                </stickbutton>
                <stickbutton index="1">
                    <slots>
                        <slot>
                            <code>0x1000013</code>
                            <mode>keyboard</mode>
                        </slot>
                    </slots>
                </stickbutton>
            </stick>
            <stick index="2">
                <diagonalRange>65</diagonalRange>
                <stickbutton index="3">
                    <mousespeedx>80</mousespeedx>
                    <mousespeedy>80</mousespeedy>
                    <slots>
                        <slot>
                            <code>4</code>
                            <mode>mousemovement</mode>
                        </slot>
                    </slots>
                </stickbutton>
                <stickbutton index="2">
                    <mousespeedx>80</mousespeedx>
                    <mousespeedy>80</mousespeedy>
                </stickbutton>
                <stickbutton index="8">
                    <mousespeedx>80</mousespeedx>
                    <mousespeedy>80</mousespeedy>
                </stickbutton>
                <stickbutton index="5">
                    <mousespeedx>80</mousespeedx>
                    <mousespeedy>80</mousespeedy>
                    <slots>
                        <slot>
                            <code>2</code>
                            <mode>mousemovement</mode>
                        </slot>
                    </slots>
                </stickbutton>
                <stickbutton index="4">
                    <mousespeedx>80</mousespeedx>
                    <mousespeedy>80</mousespeedy>
                </stickbutton>
                <stickbutton index="7">
                    <mousespeedx>80</mousespeedx>
                    <mousespeedy>80</mousespeedy>
                    <slots>
                        <slot>
                            <code>3</code>
                            <mode>mousemovement</mode>
                        </slot>
                    </slots>
                </stickbutton>
                <stickbutton index="6">
                    <mousespeedx>80</mousespeedx>
                    <mousespeedy>80</mousespeedy>
                </stickbutton>
                <stickbutton index="1">
                    <mousespeedx>80</mousespeedx>
                    <mousespeedy>80</mousespeedy>
                    <slots>
                        <slot>
                            <code>1</code>
                            <mode>mousemovement</mode>
                        </slot>
                    </slots>
                </stickbutton>
            </stick>
            <dpad index="1">
                <dpadbutton index="2">
                    <wheelspeedy>5</wheelspeedy>
                </dpadbutton>
                <dpadbutton index="8">
                    <wheelspeedy>5</wheelspeedy>
                </dpadbutton>
            </dpad>
            <trigger index="6">
                <deadZone>2000</deadZone>
                <throttle>positivehalf</throttle>
                <triggerbutton index="2">
                    <slots>
                        <slot>
                            <code>1</code>
                            <mode>mousebutton</mode>
                        </slot>
                    </slots>
                </triggerbutton>
            </trigger>
            <trigger index="5">
                <deadZone>2000</deadZone>
                <throttle>positivehalf</throttle>
                <triggerbutton index="2">
                    <slots>
                        <slot>
                            <code>3</code>
                            <mode>mousebutton</mode>
                        </slot>
                    </slots>
                </triggerbutton>
            </trigger>
            <button index="9">
                <toggle>true</toggle>
                <slots>
                    <slot>
                        <code>0x1000020</code>
                        <mode>keyboard</mode>
                    </slot>
                </slots>
            </button>
            <button index="6">
                <setselect>2</setselect>
                <setselectcondition>two-way</setselectcondition>
            </button>
            <button index="7">
                <slots>
                    <slot>
                        <code>0x1000000</code>
                        <mode>keyboard</mode>
                    </slot>
                </slots>
            </button>
            <button index="1">
                <slots>
                    <slot>
                        <code>0x20</code>
                        <mode>keyboard</mode>
                    </slot>
                </slots>
            </button>
            <button index="3">
                <slots>
                    <slot>
                        <code>0x52</code>
                        <mode>keyboard</mode>
                    </slot>
                </slots>
            </button>
        </set>
        <set index="2">
            <trigger index="6">
                <throttle>positivehalf</throttle>
            </trigger>
            <trigger index="5">
                <throttle>positivehalf</throttle>
            </trigger>
            <button index="6">
                <setselect>1</setselect>
                <setselectcondition>two-way</setselectcondition>
            </button>
        </set>
    </sets>
</gamecontroller>
EOF

# Add desktop file
cat << EOF > $APPDIR/io.playstratus.assaultcube.desktop
[Desktop Entry]
X-AppImage-Arch=x86_64
X-AppImage-Version=0.7.0
X-AppImage-Name=AssaultCube
Type=Application
Name=AssaultCube
Exec=/usr/bin/assaultcube
Categories=Game
Icon=io.playstratus.assaultcube
EOF

# Create additional required symlinks
ln -sr $SYS_DIR/docs/images/favicon.png \
    $APPDIR/io.playstratus.assaultcube.png
ln -sr $APPDIR/io.playstratus.assaultcube.png $APPDIR/.DirIcon
ln -sr $BIN_DIR/assaultcube-stage-1 $APPDIR/AppRun

# Build appimage
DEFAULT_DEST="$(dirname "$0")/build/assaultcube"
ARCH=x86_64 appimagetool $APPDIR "${1:-$DEFAULT_DEST}"
