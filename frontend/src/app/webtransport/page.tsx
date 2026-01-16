"use client";

import { useEffect, useState } from "react";

export default function WebTransportClient() {
  const [messages, setMessages] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let transport: WebTransport | null = null;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    async function startConnection() {
      try {
        transport = new WebTransport("https://localhost:4433/");

        await transport.ready;
        setConnected(true);

        const stream = await transport.createBidirectionalStream();
        const writer = stream.writable.getWriter();
        reader = stream.readable.getReader();

        writer.write(new TextEncoder().encode("Test"));                     // Send a message to the server

        async function readLoop() {                                         // Read messages from server
        if (!reader) return;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const text = new TextDecoder().decode(value);
              setMessages((prev) => [...prev, text]);
            }
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

  return (
    <div style={{ padding: 20 }}>
      <h1>WebTransport Demo</h1>

      <p>Status: {connected ? "Connected" : "Connecting..."}</p>

      <h2>Messages</h2>
      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}
