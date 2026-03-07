#!/bin/bash

# Configures a Arch-based Stratus streaming node from scratch. Adapted from
# https://disconnected.systems/blog/archlinux-installer

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
Server = https://os.playstratus.io \\
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
pacstrap -K /mnt base fastfetch linux linux-firmware networkmanager openssh \
    stratusd stratus-launcher sudo $UCODE vim

# Initialize basic config files
genfstab -U /mnt >> /mnt/etc/fstab
echo "$hostname" > /mnt/etc/hostname
sed --in-place "s|^\[core\]|$STRATUS_REPO[core]|" /mnt/etc/pacman.conf

# Enable system services
arch-chroot /mnt systemctl enable NetworkManager
arch-chroot /mnt systemctl enable sshd

# Configure stratusd user service. Note that loginctl & systemctl --user don't
# work correctly in the chroot, so we must create the required files manully.
mkdir --parents /mnt/var/lib/systemd/linger/
touch /mnt/var/lib/systemd/linger/stratusd
mkdir --parents /mnt/var/lib/stratusd/.config/systemd/user/default.target.wants
arch-chroot /mnt chown stratusd:stratusd /var/lib/stratusd/ -R
arch-chroot /mnt ln -s \
    /usr/lib/systemd/user/default.target.wants/stratusd.service \
    /var/lib/stratusd/.config/systemd/user/default.target.wants/stratusd.service

# Configure systemd-boot
arch-chroot /mnt bootctl install
echo 'default arch' > /mnt/boot/loader/loader.conf
cat << EOF > /mnt/boot/loader/entries/arch.conf
title    Arch Linux
linux    /vmlinuz-linux
initrd   /$UCODE.img
initrd   /initramfs-linux.img
options  root=PARTUUID=$(blkid -s PARTUUID -o value "$root_partition") rw
EOF

# Configure user account
pacman -Sy words --noconfirm
password=$(cat /usr/share/dict/american-english | grep -E '^[a-z]{4,8}$' | \
    shuf | head -n3 | sed 'N;N;s/\n/-/g')
echo "$password" | arch-chroot /mnt passwd stratusd --stdin
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

# Print post-installation info
echo '================================================================'
echo 'Stratus OS installation complete.'
echo 'Installation log:'
echo "    $LOG"
echo 'Password for stratusd user:'
echo "    $password"
echo 'A reboot is required.'
echo '================================================================'

# Copy install log to /var/log/ in the chroot
cp $LOG /mnt/$LOG
