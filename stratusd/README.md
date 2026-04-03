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

5.  Set applicable options via environment variables (you may find it useful to
    add these to a `.env` file that you source before running stratusd):

    - `STRATUSD_API_MSG`: An inital API message to be "received" by the SideCar
      for testing purposes (e.g.
      `'{ "type": "start_session", "timestamp": "2026-02-27 18:00:00", "request_id": "b50e8400-e29b-41d4-a716-446655440000", "payload": { "session_id": "550e8400-e29b-41d4-a716-446655440001", "game_id": "sleep", "width": 640, "height": 480, "session_token": "b020ea96-83c0-46a8-aac0-0954abd1c8ac", "user_id": "7341faed-f80e-457e-a71e-789214869c04", "user_name": "Alice" } }'`)
    - `STRATUSD_BACKEND_URL`: The URL of the backend WebSocket API
      (**required**, e.g. `ws://localhost:4000` or `wss://api.playstratus.io`)
    - `STRATUSD_CAPTURE_DEBUG`: Set to log proxied Wayland messages
    - `STRATUSD_CAPTUREPW_DEBUG`: Set to log captured PipeWire audio chunks
    - `STRATUSD_AUDIO_ENCODE_DEBUG`: Set to log encoded audio frames
    - `STRATUSD_ENCODE_DEBUG`: Set to log encoded video frames
    - `STRATUSD_GAME_DEBUG`: Set to log game output
    - `STRATUSD_GAME_DIR`: The directory containing the packaged games (defaults
      to `../games/build`)
    - `STRATUSD_IP`: The IP for stratusd that clients should connect to
      (defaults to `127.0.0.1`)
    - `STRATUSD_OUTPUT_FILE`: The H264 file to save encoded output (defaults to
      `encode_output.h264`)

6.  Run binary located at `./build/src/stratusd`
