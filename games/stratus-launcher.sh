#!/usr/bin/sh

# Usage: stratus-launcher wine <exe path relative to ~/.wine/drive_c> <args>...

# This launcher script creates a bubblewrap "sandbox" that overlays $APPDIR/c
# and $APPDIR/home into ~/.wine and ensures that all writes are non-persistant.
# It must be called from the AppRun script of an AppImage.

if [ -z "$APPDIR" -o ! -d "$APPDIR/c" -o ! -d "$APPDIR/home" ]; then
    echo 'Error: Not called from an AppImage with /c and /home directories'
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

# Construct ~/.wine directory
bwrap_args+=(
    --overlay-src ~/.wine
    --tmp-overlay ~/.wine
)
bwrap_args+=(
    --overlay-src ~/.wine/drive_c
    --overlay-src "$APPDIR/c"
    --tmp-overlay ~/.wine/drive_c
)
bwrap_args+=(
    # We don't overlay ~/.wine/drive_c/users/<user> here, so $HOME isn't exposed
    --overlay-src "$APPDIR/home"
    --tmp-overlay "$HOME/.wine/drive_c/users/$(whoami)"
)
bwrap_args+=(--chdir ~/.wine/drive_c)

bwrap "${bwrap_args[@]}" $@
