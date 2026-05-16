#!/bin/bash

# Configures a Arch-based Stratus streaming node from scratch. Adapted from
# https://disconnected.systems/blog/archlinux-installer

STRATUS_GAMES_BUCKET=https://games.playstratus.io
STRATUS_PKG_REPO=https://os.playstratus.io

# Setup basic logging and error handling
LOG=/var/log/stratus-install.log
exec 1> >(tee $LOG)
exec 2>&1
set -e

# Prompt user for installation settings
echo '================================================================'
echo '                      Stratus OS installer                      '
echo '================================================================'
echo 'Available disks:'
lsblk --nodeps --paths --noheadings -o name,size | grep --invert-match loop | \
    sed 's/^/    /'
echo -n 'Enter installation disk: '
read disk < /dev/tty
echo -n 'Enter hostname: '
read hostname < /dev/tty
echo 'Available IPs:'
ip a | grep '(?<=inet ).*' -oP | sed -E -e 's|/([^ ]* )*| (|' \
    -e 's/^/    /' -e 's/$/)/'
curl -s http://checkip.amazonaws.com | sed -e 's/^/    /' -e 's/$/ (public)/'
echo -n 'Enter IP address: '
read ip < /dev/tty
echo -n 'Enter stratusd password (leave blank to generate): '
read stratusd_password < /dev/tty
echo -n 'Enter backend password (leave blank to disable): '
read backend_password < /dev/tty
echo '================================================================'

# Partition disk
parted --script "$disk" -- mklabel gpt \
    mkpart ESP fat32 1Mib 129MiB \
    set 1 boot on \
    mkpart primary ext4 129MiB 100%

# Format partitions
boot_partition="$(ls ${disk}* | grep -E "^${disk}p?1$")"
root_partition="$(ls ${disk}* | grep -E "^${disk}p?2$")"
mkfs.vfat -F32 "$boot_partition"
mkfs.ext4 "$root_partition"

# Mount partitions
mount "$root_partition" /mnt
mkdir /mnt/boot
mount "$boot_partition" /mnt/boot

# Add stratus repository (with higher priority than core repository)
STRATUS_REPO=$(cat << EOF
[stratus] \\
SigLevel = Optional TrustAll \\
Server = $STRATUS_PKG_REPO \\
\\
\\
EOF
)
sed --in-place "s|^\[core\]|$STRATUS_REPO[core]|" /etc/pacman.conf

# Detect CPU vendor
if lscpu | grep --quiet Intel; then
    UCODE=intel-ucode
elif lscpu | grep --quiet AMD; then
    UCODE=amd-ucode
else
    echo 'ERROR: Unknown CPU vendor'
    exit 1
fi

# Install packages
packages=(base linux linux-firmware networkmanager openssh sudo $UCODE) # core
packages+=(fastfetch stratusd stratus-launcher) # stratus-specific
packages+=(htop less tmux vim) # helpful utils
pacstrap -K /mnt "${packages[@]}"

# Initialize basic config files
genfstab -U /mnt >> /mnt/etc/fstab
echo "$hostname" > /mnt/etc/hostname
sed --in-place "s|^\[core\]|$STRATUS_REPO[core]|" /mnt/etc/pacman.conf

# Enable services
arch-chroot /mnt systemctl enable NetworkManager
arch-chroot /mnt systemctl enable sshd
arch-chroot /mnt systemctl enable systemd-timesyncd
arch-chroot -S -u stratusd /mnt systemctl --user enable stratusd
arch-chroot -S -u stratusd /mnt systemctl --user enable stratus-launcher-init

# Enable linger for stratusd user. Note that loginctl doesn't work correctly in
# the chroot, so we must create the required files manully.
mkdir --parents /mnt/var/lib/systemd/linger/
touch /mnt/var/lib/systemd/linger/stratusd

# Update stratusd.conf
sed --in-place "s|#STRATUSD_IP=.*|STRATUSD_IP=$ip|" /mnt/etc/stratusd.conf
if [ -n "$backend_password" ]; then
    sed --in-place \
        "s|#STRATUSD_BACKEND_PASSWORD=.*|STRATUSD_BACKEND_PASSWORD=$backend_password|" \
        /mnt/etc/stratusd.conf
fi

# Configure systemd-boot
arch-chroot /mnt bootctl install
echo 'default stratus' > /mnt/boot/loader/loader.conf
cat << EOF > /mnt/boot/loader/entries/stratus.conf
title    Stratus OS
linux    /vmlinuz-linux
initrd   /$UCODE.img
initrd   /initramfs-linux.img
options  root=PARTUUID=$(blkid -s PARTUUID -o value "$root_partition") rw
EOF

# Configure user account
if [ -z "$stratusd_password" ]; then
    pacman -Sy words --noconfirm
    stratusd_password=$(cat /usr/share/dict/american-english | \
        grep -E '^[a-z]{4,8}$' | shuf | head -n3 | sed 'N;N;s/\n/-/g')
fi
echo "$stratusd_password" | arch-chroot /mnt passwd stratusd --stdin
arch-chroot /mnt chsh -s /usr/bin/bash stratusd
arch-chroot /mnt usermod -aG wheel stratusd
echo '%wheel ALL=(ALL:ALL) ALL' > /mnt/etc/sudoers.d/stratusd

# Configure OS info
cat << EOF > /mnt/usr/lib/os-release
NAME="Stratus OS"
PRETTY_NAME="Stratus OS"
ID=stratus
ID_LIKE=arch
BUILD_ID=rolling
HOME_URL="https://www.playstratus.io"
EOF

# Download all available games
for game in $(curl -sL $STRATUS_GAMES_BUCKET | grep -oP '(?<=Key>)[^<]+')
do
    curl -sL $STRATUS_GAMES_BUCKET/$game -o \
        /mnt/var/lib/stratusd/games/$game
    arch-chroot /mnt chown stratusd:stratusd /var/lib/stratusd/games/$game
    chmod +x /mnt/var/lib/stratusd/games/$game
done

# Print post-installation info
echo '================================================================'
echo 'Stratus OS installation complete.'
echo 'Installation log:'
echo "    $LOG"
echo 'Password for stratusd user:'
echo "    $stratusd_password"
echo 'Please review /etc/stratusd.conf and then reboot the machine.'
echo '================================================================'

# Copy install log to /var/log/ in the chroot
sed --in-place "s|$stratusd_password|********|" $LOG
cp $LOG /mnt/$LOG
