---
title: Video Capture via Wayland Proxy
author: Asher Morgan
image: ./images/wayland-proxy.png
tags: [Video, Streaming Server]
---

A core component of any game streaming service is a system for capturing video
output from games. Stratus uses a custom Wayland proxy for video capture in
order to achieve lower latencies while also balancing the amount of new
development required. This post describes why we chose this system, how we
implemented it, and how it performs in the context of game streaming.


## Wayland

First, for context, every Stratus game runs on Linux under [Wayland][wayland], a
protocol that enables clients (i.e. applications) to send frames to a server
(also called a *compositor*) to be displayed. The compositor's job is to combine
(or *composit*) the output of each client into a single frame (along with
wallpapers, toolbars, window borders, etc) and then render it on the user's
screen. (Stratus uses a headless instance of the [Sway][sway] compositor, which
is based on the popular [wlroots][wlroots] library.) The client and compositor
maintain a shared state consisting of a set of objects that are manipulated by
requests (messages from the client to compositor) and/or events (messages from
the compositor to client). The underlying format for these messages is
relatively straight-forward and is described well in the official [Wayland
Book][wayland-book-wire].

[wayland]: https://wayland.freedesktop.org
[sway]: https://swaywm.org/
[wlroots]: https://gitlab.freedesktop.org/wlroots/wlroots
[wayland-book-wire]: https://wayland-book.com/protocol-design/wire-protocol.html


## Requirements & Alternate Solutions

Having a low latency is the most important requirement of a video capture system
for game streaming. We wanted to find a method for getting access to each frame
as soon as it is rendered by the game, without any additional delays or
overhead. Unfortunately, our needs were not easily satisfied by existing
solutions.

A standard option for video capture on Wayland is the
[`ext-image-copy-capture`][ext-image-copy-capture] protocol. However, when we
started working on Stratus in late 2025, wlroots' implementation of this
protocol only supported capturing the contents of entire composed screens, not
individual windows. (This was finally resolved in March 2026 with the release of
[wlroots 0.20.0][wlroots-0.20.0].) This would have made it more difficult to
support multiple simultaneous streaming sessions on a single server (one of our
initial goals for Stratus), and would have also introduced some additional
compositing overhead. Another technique used by other game streaming services
such as NVIDIA GeForce NOW is to create virtual monitors and write a driver to
capture the frames rendered to them. This not only suffers from the same
fundamental limitation as the first option, but it also adds additional latency
due to frames being rendered to the display at a fixed refresh rate rather than
immediately after they are made available by the game.

[ext-image-copy-capture]: https://gitlab.freedesktop.org/wayland/wayland-protocols/-/blob/main/staging/ext-image-copy-capture/ext-image-copy-capture-v1.xml
[wlroots-0.20.0]: https://gitlab.freedesktop.org/wlroots/wlroots/-/releases/0.20.0

A third option that we began investigating was to build our own Wayland
compositor that could capture video frames as they were sent by clients. This
would give us access to frames from individual windows before they were
composited like we wanted, and could theoretically give us the earliest possible
access to frames (at least without modifying the games themselves). However, we
found that this would have required much more development work than we had the
capacity for, most of which wasn't even directly related to video capture. So
instead, we settled on a different, even more novel option: capture frames via a
custom Wayland proxy. The proxy would sit in between clients and the real
Wayland compositor and forward messages between them while listening for
messages related to new frames.

## The Proxy

However, implementing a Wayland proxy turned out to be much more involved than
we anticipated. The standard Wayland library, [libwayland][libwayland], is not
designed to be used on the client-side and server-side of a Wayland connection
simultaneously. Object interfaces are closely tied to the client or server they
were created in and different functions are used for similar actions in client-
and server-side programs, including for the global event loop. Additionally,
callbacks for handling Wayland messages are specific to a particular object type
and must be registered on a per-object basis. So implementing a Wayland proxy
using libwayland would require a custom global event loop with thousands of
lines of boilerplate code generated to automatically register message handlers
for each created object, with each handler reconstructing each received message
to be sent out the other side of the proxy.

But despite its shortcomings, libwayland still contains valuable code for
creating Wayland connections, de/serializing messages, and managing Wayland
objects. This functionality is just not exposed publicly by the library. So to
minimize the amount of code we would need to (re)write, we decided to patch
libwayland to expose this lower-level functionality and disable its restrictive
higher-level features. This approach was heavily inspired by Boyan Ding's
[wayland-tracer][wayland-tracer] project, which implements a basic Wayland proxy
for debugging Wayland applications in a similar way.

We were able to adapt libwayland to our needs with less than two dozen small
changes (excluding removing unused code), most of which just removed `static`
keywords from function declarations or commented out unnecessary references to
higher-level libwayland structs. The patched library is available in the Stratus
repository under [`stratusd/libs/wayland/`][stratus-libwayland]. It is used to
create a robust proxy system in [`stratusd/Capture/src/proxy.c`][stratus-proxy]
that accepts connections from clients, forwards Wayland messages between the
clients and the system's real compositor, and provides a generic `on_message`
handler that we can use to implement video capture.

[libwayland]:           https://gitlab.freedesktop.org/wayland/wayland
[wayland-tracer]:       https://github.com/dboyan/wayland-tracer
[stratus-libwayland]:   https://github.com/PlayStratus/Stratus/tree/main/stratusd/libs/wayland
[stratus-proxy]:        https://github.com/PlayStratus/Stratus/blob/main/stratusd/Capture/src/proxy.c


## The Capture System

Although the patched libwayland library makes proxying easy, doing additional
processing of Wayland messages requires reimplementing some of the higher-level
object management functionality that we bypassed in libwayland. Luckily, we
don't actually need to handle very many messages to implement video capture.

First, before capturing frames, we wanted to force the game to render itself in
full screen mode (which is typically preferred for gaming) and with dimensions
matching the user's screen size. This was easily implemented by modifying the
contents of several Wayland events as they pass through the proxy. The first was
`wl_output@mode` (that is, the `mode` message associated with `wl_output`
objects), which is sent to advertise the available resolutions and refresh rates
for each screen. The second was the `xdg_toplevel@configure` message, which is
sent to request an update to a Wayland client's window state. By changing the
dimensions advertised in `wl_output@mode` events and adding the fullscreen
property to `xdg_toplevel@config` events, we can force games to render
themselves in fullscreen mode at our desired dimensions. Although overwriting
messages does introduce inconsistencies into the state of the objects shared
between the game and compositor, we can avoid actual conflicts in this case by
making sure to drop all other messages that specify screen dimensions or modify
the window state.

![Enforcing desired fullscreen dimensions via the Wayland
proxy.](./images/wayland-proxy-resize.png)

Capturing the video frames themselves is a bit more involved. Under Wayland, an
app's windows are represented by `wl_surface` objects, with the underlying
pixels for each surface accessed via `wl_buffer` objects. These buffers can
either be created as shared host memory (SHM) buffers from a `wl_shm_pool`
object, or as direct memory access buffers (DMA) using a
`zwp_linux_buffer_params_v1` object. In order to render a new frame, the client
*attaches* one or more `wl_buffer` objects to a `wl_surface` and sends a
`wl_surface@commit` request. Once the compositor has rendered the frame and is
done using the underlying buffer, it sends a `wl_buffer@release` event to signal
that the client may take back ownership of the buffer and use it again for
future frames. Finally, when the client is done using a Wayland object such as a
`wl_buffer`, it destroys it by sending a `destroy` message.

So to capture video through the proxy, Stratus implements a system for keeping
track of the state of the relevant `wl_surface`, `wl_buffer`, `wl_shm_pool`, and
`zwp_linux_buffer_params_v1` objects so that when a `wl_surface@commit` message
is received, the appropriate buffer can be read, encoded, and sent to the user.
Additionally, `wl_buffer@release` events sent by the compositor are held back
until frame processing is complete to prevent the game from modifying the buffer
while Stratus is still processing it. Lastly, local objects are marked as
deleted when the associated `destroy` requests are received. However, Wayland
allows clients to destroy objects "out of order" (for example, destroying a
`wl_shm_pool` object before its child `wl_buffer` object), so the capture system
must track object dependencies to ensure that an object's resources are only
freed after they are no longer required by any other object.

![Using the Wayland proxy to intercept frames from SHM buffers. Capturing from
DMA buffers works very similarly.](./images/wayland-proxy-shm-buffers.png)


## Results

The final capture system flawlessly intercepts frames for Stratus games with a
per-frame overhead of around 10 microseconds. Although we have not had the
chance to perform a thorough comparison with alternative video capture
solutions, we believe that our unique Wayland proxy architecture achieves
latencies that are close to the limit of what is possible for video capture on
Wayland. While there remains low hanging fruit for improving latency in Stratus'
encoding and transport stages, this is not the case with the capture stage. The
video capture system provides a solid low-latency foundation that the rest of
the Stratus video pipeline builds on top of. For a detailed analysis of Stratus'
overall performance, including a comparison with other game streaming services,
see [this post][blogs-performance].

[blogs-performance]:    ./Blog_Stratus_Performance.md


## Limitations

The major limitation of Stratus' video capture system is that it depends on the
cooperation of Wayland clients. It assumes that they will render their content
in a Wayland surface backed by exactly one buffer, and that this buffer will
match the requested dimensions. As a result, it does not support advanced
Wayland features such as subsurfaces, attaching multiple buffers to a single
surface, changing XDG surface geometry to add buffer padding, or transforming
buffers via the Viewporter protocol. It also does not support games that refuse
to follow the screen dimensions requested by the proxy. Adding support for all
of these edge cases is certainly possible, but would dramatically increase the
complexity of the capture system and push it further in the direction of
becoming a full-fledged Wayland compositor. Luckily, the vast majority of games
cooperate when running in fullscreen mode, so this architecture has worked very
well for Stratus.
