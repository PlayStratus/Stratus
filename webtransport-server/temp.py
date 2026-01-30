import os
import av

print("Reading H.264 video...")


container = av.open("encode_output.h264", format="h264")
stream = next((s for s in container.streams if s.type == "video"), None)

packet_count = 0
for packet in container.demux(stream):
    if packet is None:
        continue

    encoded_bytes = bytes(packet)
    print(f"Packet size: {len(encoded_bytes)} bytes")
    packet_count += 1

if packet_count == 0:
    print("No packets found. The file may lack Annex B start codes or the format probe failed.")