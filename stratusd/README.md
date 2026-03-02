# stratusd

`stratusd` is the software that will run on each node in the streaming server
cluster.

## Development Setup

1.  Install required dependencies:

    - Debian, Ubuntu, etc: `# apt install libpipewire libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libgl1-mesa-dev libegl1-mesa-dev libgles2-mesa-dev libdrm-dev libglvnd-dev libegl-dev libgles-dev`
    - RHEL, Fedora, etc: `# dnf install pipewire-devel ffmpeg-devell mesa-libGL mesa-libEGL mesa-libGLES libdrm libdrm-devel libglvnd libglvnd-devel libglvnd-egl libglvnd-gles`
    - Arch: `# pacman -S libpipewire ffmpeg mesa libdrm libglvnd`

2.  Generate CMake build files with `cmake -DCMAKE_BUILD_TYPE=Debug -B ./build`

3.  Build project with `cmake --build ./build`

4.  Run binary located at `./build/src/stratusd`
