# Stratus Frontend

The frontend is a Next.js app written with TypeScript and TailwindCSS.
Communication with stream servers is done over WebTransport and WebCodecs is
used for rendering game audio and video.


## Development Setup

1.  Set applicable options in a `.env` file:

    - `NEXT_PUBLIC_BACKEND_PATH`: the URL of the backend server (defaults to
      `http://localhost:4000`)
    - `GOOGLE_CLIENT_ID`: the Google client ID used for OAuth (**required**)

2.  Install the required dependencies with `npm install`

3.  Start the development server with `npm dev`

4.  Go to [localhost:3000](http://localhost:3000) in your browser
