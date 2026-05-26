---
title: Stratus Stream Performance
author: Amin Hussien
image: /images/MinecraftGlasstoGlass.webp
tags: [Performance]
pinned: true
---

It only takes a second for a player to complain that a game stream is lagging. Yet quantifying this lag is more nuanced than you might think. For the purpose of this post, we will identify 3 types of latency. Time to First Image is the time it takes between pressing play and the game appearing on your screen. Glass to Glass Latency is the time it takes for a video frame on the server to reach the client. And lastly, Click to Photon latency is the time it takes for the stream to react to player input. 

### Time to First Image

| Stratus     | Geforce Now  |
| ----------- | ------------ |
| ![](https://us-west-stratus-game-image.s3.us-west-2.amazonaws.com/StratusLaunch.webp) | ![](https://us-west-stratus-game-image.s3.us-west-2.amazonaws.com/GeforceLaunch.webp) |


| Amazon Luna  | Xbox Cloud Gaming |
| ----------- | ------------ |
| ![](https://us-west-stratus-game-image.s3.us-west-2.amazonaws.com/LunaLaunch.webp) | ![](https://us-west-stratus-game-image.s3.us-west-2.amazonaws.com/XboxLaunch.webp)|

| Stratus | Geforce Now  | Amazon Luna | Xbox Cloud Gaming |
| :--- | :--- | :--- | :--- |
| 2.1 Seconds | 47 Seconds | 50 Seconds | 3 Seconds |


The start of every stream begins with a push of a button, at which point the streaming service must match your request to stream with a compatible node and begin the stream, which may involve a VM being provisioned or a prewarmed instance being allocated to you. Since no one benefits from long loading screens, the faster this can occur, the better the user experience. This is an area in which Stratus excels. Competing game streaming typically create an entire Windows VM for each session. Stratus instead utilizes Linux namespaces and cgroups to quickly create an immutable environment for each game session to run within, allowing for sessions to start within 2 seconds.

Microsoft's Xbox Cloud Gaming also has an extremely competitive time to first image of 3 seconds. The game streaming nodes that power Xbox Cloud Gaming run the same operating system as the Xbox One and Xbox Series S/X and do not suffer from the issue highlighted above. Even Microsoft understands that running desktop Windows on game streaming nodes is a really bad idea.


Certain game streaming services like GeForce Now use a technique called [prewarming](https://github.com/NVIDIAGameWorks/GeForceNOW-SDK/blob/master/samples/README.md) to reduce time-to-first-image. This allows a server node to launch and initialize a game before the user even requests a session. Stratus is able to maintain fast launch times without the use of prewarming.


### Glass to Glass Latency

The most straightforward method we found for recording glass to glass latency has been to place the server and client displays side by side, recording them at 240 FPS manually counting the number of frames between an image appearing on the server display and the client display. Typically Stratus nodes are headless and do not output video to a display. In order to facilitate latency testing we configured stratus to output to 

In our testing, Stratus 1080P 60 FPS streams have an average Glass to Glass latency as low as 20 ms without the use of hardware video encoding. 

![Glass to Glass Latency Test Recorded at 240 FPS](https://us-west-stratus-game-image.s3.us-west-2.amazonaws.com/MinecraftGlasstoGlassTimeCode.webp)

### Encode Time
Due to our choice of server hardware (BC-250s), we are unable to use hardware video encoding therefore we spend 16 MS encoding each frame of video. If we were to implement hardware encode support encode latency would drop down to 2-4 MS.

![Software Encode Latency Profile](./images/Encode_Time.png)


### Capture Time
Due to our novel frame capture method of intercepting Wayland messages from the game before they reach the compositor, our time spent capturing frames is quite negligible, with typically less than 7 microseconds spent capturing each frame. This method of frame capture also allows us to enforce display requirements on the game process, such as enforcing an arbitrary resolution or refresh rate.

![Capture Latency Profile](./images/Capture_Time.png)

### Click to Photon Latency
Click-to-photon latency is the most representative latency metric for a game streaming service, as it does not matter how smooth the video stream appears if it takes forever to respond to your inputs. In our testing, Stratus has a click-to-photon latency as fast as 40 ms under ideal conditions.


![Click to Photon Latency Test](https://us-west-stratus-game-image.s3.us-west-2.amazonaws.com/ClickToPhoton.webp)


