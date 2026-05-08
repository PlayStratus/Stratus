#!/usr/bin/sh

# Usage:
#   stratus-launcher --init
#   stratus-launcher [--amx-profile <path>] wine \
#       <exe path relative to $APPDIR> <args>...

# This launcher script creates a bubblewrap "sandbox" that ensures that all
# writes are non-persistent. It must be called from the AppRun script of an
# AppImage.

set -e

# Ensure wine server is shutdown correctly
# Note: this won't work if stratus-launcher itself is SIGKILL'd
cleanup() {
    echo 'Killing wineserver...'
    wineserver --kill
}
trap cleanup EXIT

PROGRAM_FILES="$HOME/.wine/drive_c/Program Files"

# Initialize game environment
if [ "$1" = '--init' ]; then
    if [ -z "$WAYLAND_DISPLAY" ]; then
        echo "Error: the vcrun2015 installer requires a Wayland server"
        exit 1
    fi

    # Initialize wine prefix
    wineboot --init

    # Install required libraries
    winetricks -q dotnet45
    winetricks -q vcrun2015

    # Install AntiMicroX to support keyboard-only games
    if [ ! -d "$PROGRAM_FILES/antimicrox-3.6.0-PortableWindows-AMD64/" ]; then
        curl -L https://github.com/AntiMicroX/antimicrox/releases/download/3.6.0/antimicrox-3.6.0-PortableWindows-AMD64.zip \
            -o "$PROGRAM_FILES/amx.zip"
        unzip -o "$PROGRAM_FILES/amx.zip" -d "$PROGRAM_FILES"
        rm "$PROGRAM_FILES/amx.zip"
    else
        echo 'Skipping AntiMicroX because it is already installed'
    fi

    exit 0
fi

# Parse --amx-profile arg
if [ "$1" = '--amx-profile' ]; then
    AMX_PROFILE="$2"
    shift 2
else
    AMX_PROFILE=""
fi

# Check preconditions
if [ -z "$APPDIR" ]; then
    echo 'Error: Not called from an AppImage'
    exit 1
fi
if [ ! -d ~/.wine ]; then
    echo "Error: ~/.wine does not exist, please run $(basename $0) --init"
    exit 1
fi

bwrap_args=()

# Add standard system directories to sandbox
bwrap_args+=(--dev-bind /dev /dev)
bwrap_args+=(--ro-bind /etc /etc)
bwrap_args+=(--proc /proc)
bwrap_args+=(--bind /run /run)
bwrap_args+=(--ro-bind /sys /sys)
bwrap_args+=(--dir /tmp)
bwrap_args+=(--ro-bind /usr /usr)
bwrap_args+=(--symlink /usr/bin /bin)
bwrap_args+=(--symlink /usr/sbin /sbin)
bwrap_args+=(--symlink /usr/lib /lib)
bwrap_args+=(--symlink /usr/lib /lib64)
bwrap_args+=(--dir /var)

# Bind ~/.wine directory
bwrap_args+=(
    --overlay-src ~/.wine
    --tmp-overlay ~/.wine
)
bwrap_args+=(
    # Prevent $HOME from being exposed and make user changes non-persistent
    --tmpfs "$HOME/.wine/drive_c/users/$(whoami)"
)

# Bind $APPDIR directory
bwrap_args+=(
    --ro-bind "$APPDIR" "$APPDIR"
)
bwrap_args+=(--chdir "$APPDIR")

# Run bubblewrap
DISPLAY= bwrap "${bwrap_args[@]}" bash << EOF
# Start AntiMicroX if enabled
[ -n "$AMX_PROFILE" ] && wine \
    "$PROGRAM_FILES/antimicrox-3.6.0-PortableWindows-AMD64/bin/antimicrox.exe" \
    --hidden --no-tray --profile $AMX_PROFILE &

cleanup() {
    # Stop AntiMicroX if enabled
    [ -n "$AMX_PROFILE" ] && killall antimicrox.exe
}
trap cleanup EXIT

# Run user payload
$@
EOF
