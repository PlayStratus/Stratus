"use client";

import { useEffect, useRef, useState } from "react";

export default function WebTransportClient() {
  const [images, setImages] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [outgoing, setOutgoing] = useState("");

  
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);

  useEffect(() => {
    let transport: WebTransport | null = null;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    async function startConnection() {
      try {
        transport = new WebTransport("https://localhost:4433/");
        await transport.ready;
        setConnected(true);

        writerRef.current = transport.datagrams.writable.getWriter();

        reader = transport.datagrams.readable.getReader();

        async function readLoop() {
          
          if (!reader) return;

          while (true) {                                          //read images
            const { value, done } = await reader.read();
            if (done) break;
            if (!value) continue;
                                                                    //work on implementing reciever here. My attempts have not worked https://stackoverflow.com/questions/21585681/send-image-data-over-rtc-data-channel
            
            
          }
        }

        readLoop();
      } catch (err) {
        console.error("WebTransport connection failed:", err);
      }
    }

    startConnection();

    return () => {
      reader?.cancel();
      transport?.close();
    };
  }, []);

  async function sendMessage() {                          //send message to get images
    if (!writerRef.current) return;
    const data = new TextEncoder().encode("a");
    await writerRef.current.write(data);

    setOutgoing("");
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>WebTransport Image</h1>

      <p>Status: {connected ? "Connected" : "Connecting..."}</p>

      <div style={{ marginBottom: 20 }}>        
        <button onClick={sendMessage} disabled={!connected}>
          Send
        </button>
      </div>

      <h2>Images</h2>
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          style={{ maxWidth: "300px", marginBottom: 20 }}
        />
      ))}
    </div>
  );
}
