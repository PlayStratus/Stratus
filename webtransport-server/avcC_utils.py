"""
When decoding with avc1.42C01E on the clients WebCodec it required having a description. First approach was to do this on the client, but it seems more reliable to do it on the server side.

Figuring this out seemed tricky and tedious so I just used ChatGPT and copied it into here and just said to myself that StradusD encoding side should handle this lol. 

Extra notes:
I was previously using VP9 to encode and decode and that was much easier to set up with just calling that API and only sending the length of the frame bytes as the prefix. 
"""

def split_annexb_nals(data: bytes) -> list[bytes]:
    # returns NAL units without start codes
    nals = []
    i = 0
    n = len(data)

    def find_start(pos: int) -> int:
        # find next 00 00 01 or 00 00 00 01
        for j in range(pos, n - 3):
            if data[j] == 0 and data[j+1] == 0:
                if data[j+2] == 1:
                    return j
                if j + 3 < n and data[j+2] == 0 and data[j+3] == 1:
                    return j
        return -1

    start = find_start(0)
    while start != -1:
        # skip the start code
        if data[start:start+3] == b"\x00\x00\x01":
            nal_start = start + 3
        else:
            nal_start = start + 4

        next_start = find_start(nal_start)
        nal_end = next_start if next_start != -1 else n

        nal = data[nal_start:nal_end]
        if nal:
            nals.append(nal)

        start = next_start

    return nals

def nal_type(nal: bytes) -> int:
    return nal[0] & 0x1F
  
def make_avcc_description(sps: bytes, pps: bytes) -> bytes:
    # AVCDecoderConfigurationRecord (like MP4 avcC box payload)
    # lengthSizeMinusOne = 3 => 4-byte NAL lengths
    profile_idc = sps[1]
    constraints = sps[2]
    level_idc = sps[3]

    out = bytearray()
    out += b"\x01"
    out += bytes([profile_idc, constraints, level_idc])
    out += b"\xFF"              # reserved + lengthSizeMinusOne(3)
    out += b"\xE1"              # reserved + numOfSPS(1)
    out += len(sps).to_bytes(2, "big") + sps
    out += b"\x01"              # numOfPPS(1)
    out += len(pps).to_bytes(2, "big") + pps
    return bytes(out)
  
def annexb_au_to_avcc(packet_bytes: bytes):
    nals = split_annexb_nals(packet_bytes)
    is_idr = any(nal_type(n) == 5 for n in nals)
    sps = next((n for n in nals if nal_type(n) == 7), None)
    pps = next((n for n in nals if nal_type(n) == 8), None)

    avcc = bytearray()
    for nal in nals:
        avcc += len(nal).to_bytes(4, "big")
        avcc += nal

    return bytes(avcc), is_idr, sps, pps
  