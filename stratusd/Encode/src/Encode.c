#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/avutil.h>

void test_ffmpeg() {
    unsigned int version = avcodec_version();
    printf("FFmpeg libavcodec version: %u\n", version);
    printf("FFmpeg version string: %s\n", av_version_info());
}

void init_encoder() {
    const AVCodec *codec = avcodec_find_encoder(AV_CODEC_ID_H264);
    if (!codec) {
        fprintf(stderr, "H264 codec not found\n");
        return;
    }
    printf("Found H264 encoder: %s\n", codec->name);
}


