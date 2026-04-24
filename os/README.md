# Stratus OS

Stratus OS is a custom Arch Linux installation for Stratus streaming nodes. It
consists of an automatic installation script and several custom Arch packages to
set up Stratus games and the stratusd daemon.


## Setup

To setup a streaming node, boot into a live Arch Linux environment on the
machine and run the following command:

```
# curl -sL os.playstratus.io/install.sh | bash
```

When the script completes, make a note of the account password that was printed
and then reboot the machine to complete the installation.
