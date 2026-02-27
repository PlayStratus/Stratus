# stratusd

`stratusd` is the software that will run on each node in the streaming server
cluster.

## Development Setup

1.  Install required dependencies:

    - Debian, Ubuntu, etc: `# apt install pipewire libavcodec-dev libavformat-dev libavutil-dev libcjson-dev libcurl4-openssl-dev libevdev-dev libswscale-dev libgl1-mesa-dev libegl1-mesa-dev libgles2-mesa-dev libdrm-dev libglvnd-dev libegl-dev libgles-dev`
    - RHEL, Fedora, etc: `# dnf install cjson-devel libcurl-devel libevdev-devel pipewire-devel ffmpeg-devel mesa-libGL mesa-libEGL mesa-libGLES libdrm libdrm-devel libglvnd libglvnd-devel libglvnd-egl libglvnd-gles`
    - Arch: `# pacman -S cjson libevdev libpipewire ffmpeg mesa libdrm libglvnd`

2.  Configure `/dev/uinput` to be user-writable (required by Input module):

    ```
    # cp ../os/stratusd/udev.rules > /etc/udev/rules.d/60-stratus.rules
    # usermod -aG input <username>
    # reboot
    ```

3.  Generate CMake build files with `cmake -DCMAKE_BUILD_TYPE=Debug -B ./build`

4.  Build project with `cmake --build ./build`

5.  Set applicable options via environment variables:

    - `STRATUSD_BACKEND_URL`: The URL of the backend WebSocket API
      (**required**, e.g. `ws://localhost:4000` or `wss://api.playstratus.io`)
    - `STRATUSD_GAME_DIR`: The directory containing the packaged games (defaults
      to `../games/build`)
    - `STRATUSD_OUTPUT_FILE`: The H264 file to save encoded output (defaults to
      `encode_output.h264`)

6.  Run binary located at `./build/src/stratusd`

    - To start a session without being triggered by the backend, uncomment the
      `api_recv` call in `sidecar_main`
