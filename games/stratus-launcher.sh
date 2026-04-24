#!/usr/bin/sh

# Usage: stratus-launcher wine <exe path relative to ~/.wine/drive_c> <args>...

# This launcher script creates a bubblewrap "sandbox" that overlays $APPDIR/c
# and $APPDIR/home into ~/.wine and ensures that all writes are non-persistant.
# It must be called from the AppRun script of an AppImage.

if [ -z "$APPDIR" ]; then
    echo 'Error: Not called from an AppImage'
    exit 1
fi

# Ensure wine has been initialized
wineboot --init

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
    # Prevent $HOME from being exposed and make user changes non-persistant
    --tmpfs "$HOME/.wine/drive_c/users/$(whoami)"
)

# Bind $APPDIR directory
bwrap_args+=(
    --ro-bind "$APPDIR" "$APPDIR"
)
bwrap_args+=(--chdir "$APPDIR")

bwrap "${bwrap_args[@]}" $@
