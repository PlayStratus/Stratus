# stratusd

`stratusd` is the software that will run on each node in the streaming server
cluster.

## Development Setup

1.  Install required dependencies:

    ```
    # pacman -S cjson ffmpeg libevdev libdrm libglvnd libpipewire mesa
    ```

2.  Configure `/dev/uinput` to be user-writable (required by Input module):

    ```
    # cp ../os/stratusd/udev.rules > /etc/udev/rules.d/60-stratus.rules
    # usermod -aG input <username>
    # reboot
    ```

3.  Generate dev certificates for Transport module

    ```
    $ ./libs/libquiche/scripts/GenerateCerts.sh
    ```

4.  Generate CMake build files with `cmake -DCMAKE_BUILD_TYPE=Debug -B ./build`

5.  Build project with `cmake --build ./build`

6.  Set applicable options via environment variables (you may find it useful to
    `export` these in a `.env` file that you source before running stratusd):

    - `STRATUSD_API_DEBUG`: Set to log sent and received API messages
    - `STRATUSD_API_MSG`: An inital API message to be "received" by the SideCar
      for testing purposes (e.g.
      `'{ "type": "start_session", "timestamp": "2026-02-27 18:00:00", "request_id": "b50e8400-e29b-41d4-a716-446655440000", "payload": { "session_id": "550e8400-e29b-41d4-a716-446655440001", "game_id": "sleep", "width": 640, "height": 480, "session_token": "b020ea96-83c0-46a8-aac0-0954abd1c8ac", "user_id": "7341faed-f80e-457e-a71e-789214869c04", "user_name": "Alice" } }'`)
    - `STRATUSD_AUDIO_ENCODE_DEBUG`: Set to log encoded audio frames
    - `STRATUSD_BACKEND_URL`: The URL of the backend WebSocket API
      (**required**, e.g. `ws://localhost:4000` or `wss://api.playstratus.io`)
    - `STRATUSD_CAPTURE_DEBUG`: Set to log proxied Wayland messages
    - `STRATUSD_CAPTUREPW_DEBUG`: Set to log captured PipeWire audio chunks
    - `STRATUSD_ENCODE_DEBUG`: Set to log encoded video frames
    - `STRATUSD_GAME_DEBUG`: Set to log game output
    - `STRATUSD_GAME_DIR`: The directory containing the packaged games (defaults
      to `../games/build`)
    - `STRATUSD_IP`: The IP for stratusd that clients should connect to
      (defaults to `127.0.0.1`)
    - `STRATUSD_OUTPUT_FILE`: The H264 file to save encoded output (defaults to
      `encode_output.h264`)
    - `STRATUSD_SIDECAR_ONESHOT`: Set to make stratusd exit after the first
      session is stopped

7.  Run binary located at `./build/src/stratusd`

8.  If connected to the stream locally, use the following chromium flags:

    ```
    chromium -origin-to-force-quic-on=localhost:4433 --ignore-certificate-errors-spki-list=<base64 SPKI fingerprint>
    ```
