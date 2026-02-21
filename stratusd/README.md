# stratusd

`stratusd` is the software that will run on each node in the streaming server
cluster.

## Development Setup

1.  Install required dependencies:

    - Debian, Ubuntu, etc: `# apt install pipewire libavcodec-dev libavformat-dev libavutil-dev libevdev-dev libswscale-dev`
    - RHEL, Fedora, etc: `# dnf install libevdev-devel pipewire-devel ffmpeg-devel`
    - Arch: `# pacman -S libevdev libpipewire ffmpeg`

2.  Configure `/dev/uinput` to be user-writable (required by Input module):

    ```
    # cp ../os/stratusd/udev.rules > /etc/udev/rules.d/60-stratus.rules
    # usermod -aG input <username>
    # reboot
    ```

3.  Generate CMake build files with `cmake -DCMAKE_BUILD_TYPE=Debug -B ./build`

4.  Build project with `cmake --build ./build`

5.  Run binary located at `./build/src/stratusd`
