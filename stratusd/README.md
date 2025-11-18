# stratusd

`stratusd` is the software that will run on each node in the streaming server
cluster.

## Development Setup

1.  Install required dependencies:

    - Debian, Ubuntu, etc: `# apt install libpipewire libwayland-dev libavcodec-dev libavformat-dev libavutil-dev libswscale-dev`
    - RHEL, Fedora, etc: `# dnf install pipewire-devel wayland-devel ffmpeg-devel`
    - Arch: `# pacman -S libpipewire wayland ffmpeg`

2.  Generate CMake build files with `cmake -B ./build`

3.  Build project with `cmake --build ./build`

4.  Run binary located at `./build/src/stratusd`
