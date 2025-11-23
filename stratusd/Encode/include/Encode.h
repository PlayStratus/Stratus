#ifndef ENCODE_H
#define ENCODE_H



void create_sample_video(const char *filename, int width, int height, int num_frames);
void encode_argb_video(const char *input_file, const char *output_file,
                       int width, int height, int num_frames);


#endif
