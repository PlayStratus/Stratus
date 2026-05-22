# stratusd

stratusd is the service that runs on each streaming node to execute games and
stream game I/O. It a C/C++ project built with CMake and is composed of seven
modules:

- **Capture**: responsible for capturing video frames via Wayland
- **CapturePw**: responsible for capturing audio frames via PipeWire
- **Common**: contains shared headers and ring buffer implementations
- **Encode**: responsible for encoding video and audio frames using FFmpeg and
  OpenGL
- **Input**: responsible for injecting controller input via libevdev
- **SideCar**: responsible for session lifecycle and running the other modules
  in separate threads
- **Transport**: responsible for communication with client using QUICHE

Note that at the moment, each instance of stratusd only supports a single
concurrent stream session.


## Development Setup

1.  Install required dependencies:

    ```
    # pacman -S cjson ffmpeg libevdev libdrm libglvnd libpipewire mesa opus
    ```

2.  Configure `/dev/uinput` to be user-writable (required by Input module):

    ```
    # cp ../os/stratusd/udev.rules > /etc/udev/rules.d/60-stratus.rules
    # usermod -aG input <username>
    # reboot
    ```

3.  Generate CMake build files with `cmake -DCMAKE_BUILD_TYPE=Debug -B ./build`

4.  Build project with `cmake --build ./build`

5.  Set any desired options via environment variables (you may find it useful to
    `export` these in a `.env` file that you source before running stratusd):

    - `STRATUSD_API_DEBUG`: Set to log sent and received API messages
    - `STRATUSD_API_MSG`: An optional API message to be "received" by the
      SideCar on startup for testing purposes (e.g.
      `'{ "type": "start_session", "timestamp": "2026-02-27 18:00:00", "request_id": "b50e8400-e29b-41d4-a716-446655440000", "payload": { "session_id": "550e8400-e29b-41d4-a716-446655440001", "game_id": "sleep", "width": 640, "height": 480, "session_token": "b020ea96-83c0-46a8-aac0-0954abd1c8ac", "user_id": "7341faed-f80e-457e-a71e-789214869c04", "user_name": "Alice" } }'`)
    - `STRATUSD_AUDIO_ENCODE_DEBUG`: Set to log encoded audio frames
    - `STRATUSD_BACKEND_PASSWORD`: The password used to authenticate with
      the backend WebSocket API (if left undefined, authentication is disabled)
    - `STRATUSD_BACKEND_URL`: The optional backend server's WebSocket API's URL (e.g.
      `ws://localhost:4000`)
    - `STRATUSD_CAPTURE_DEBUG`: Set to log proxied Wayland messages
    - `STRATUSD_CAPTUREPW_DEBUG`: Set to log captured PipeWire audio chunks
    - `STRATUSD_ENCODE_DEBUG`: Set to log video encoding info & warnings
    - `STRATUSD_GAME_DEBUG`: Set to log game output
    - `STRATUSD_GAME_DIR`: The directory containing the packaged games (defaults
      to `../games/build`)
    - `STRATUSD_INPUT_DEBUG`: Set to log received input messages
    - `STRATUSD_IP`: The IP for stratusd that clients should connect to
      (defaults to `127.0.0.1`)
    - `STRATUSD_PORT`: The UDP port to listen for WebTransport connections on
      (defaults to 4433)
    - `STRATUSD_SIDECAR_ONESHOT`: Set to make stratusd exit after the first
      session is stopped
    - `STRATUSD_TRANSPORT_DEBUG`: Set to log transport connection warnings

6.  Run binary located at `./build/src/stratusd`

7.  If using the `STRATUSD_API_MSG` option to start a session manually, open the
    [Direct Connect][direct-connect] page to connect to the stream. Otherwise,
    initiate a stream through the frontend (this requires
    `STRATUSD_BACKEND_URL` to be set).


[direct-connect]: https://www.playstratus.io/direct-connect
