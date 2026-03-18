# Audio Capture Pipeline

## Usage
A `output_audio.pcm` file will be generated when `./build/stratusd` is ran. This file will contain all of the raw audio generated from the desktop. 

To convert the `.pcm` file to a `.mp3` file run:
```
ffmpeg -f f32le -ar 48000 -ac 2 -i output_audio.raw -codec:a libmp3lame -qscale:a 2 output.mp3
```

## Implementation

![Audio Capture Pipeline](/stratusd/CapturePw/docs/pipeline.png)

### [Audio Capture with PipeWire](/stratusd/CapturePw/src/CapturePw.c)

> Used [Pipewire Audio Capture Example](https://docs.pipewire.org/audio-capture_8c-example.html) as a reference to capture audio from the desktop.  

#### Initialization

- Gets the format (sample_rate and channels) of the desktop audio stream
- Starts the audio encoder thread and initializes the audio ring buffer

#### Capture Loop
- Captures audio frames from the desktop and writes them to the audio ring buffer

### [Audio Ring Buffer](/stratusd/CapturePw/src/AudioRingBuffer.c)

> Saw this [reddit post](https://www.reddit.com/r/C_Programming/comments/1f2k7u6/how_are_memory_buffers_reallocatedmanaged_for/) and it talked about ring buffers and just followed it lol

#### Producer

When the Audio Capture thread captures a frame it locks the ring buffer, writes the frame to the buffer, and then unlocks it. If the buffer is full, it will overwrite the oldest frame in the buffer.

#### Ring Buffer

"A **ring buffer (circular buffer)** is a fixed-size array that stores data in a loop. It uses two pointers—**head** (write) and **tail** (read)—and when the end is reached, it wraps back to the beginning. This allows continuous data flow without reallocating memory, making it ideal for real-time systems like audio streaming." (What is a ring buffer? - ChatGPT)

#### Consumer

The Audio Encoder thread locks the ring buffer, reads a frame from the buffer, and then unlocks it. If the buffer is empty, it will wait until a frame is produced.

### [Audio Encoder](/stratusd/Encode/src/EncodeAudio.c)

> Copied layout of Encoder. Currently it just consumes the audio frame data and writes to a raw PCM file. 

#### Generates output file
- Gets the `output_audio.pcm` file generated and ready to append the audio frame data

#### Write audio frame
- Writes/appends the audio frame data to the `output_audio.pcm` file

## Future Work
- In the [Audio Encoder](/stratusd/Encode/src/EncodeAudio.c), encode with the Opus codec. This codec at least is on my browser's Audio WebCodec, and when I researched (asked ChatGPT) about which audio codec is best for streaming, Opus was the most recommended one. 
