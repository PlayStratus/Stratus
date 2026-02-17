# Stratus Operating System

This directory contains custom packages for running a stratusd node on Arch
Linux.

To setup a streaming node, run the following commands:

```
$ makepkg --dir stratusd --install
$ sudo loginctl enable-linger stratusd
$ sudo -u stratusd XDG_RUNTIME_DIR=/run/user/$(id -u stratusd) systemctl --user enable stratusd
$ sudo reboot now
```
