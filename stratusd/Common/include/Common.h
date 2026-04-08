#ifndef COMMON_H
#define COMMON_H

#include <stddef.h>
#include <stdint.h>
#include <pthread.h>

struct ring_buffer;

struct ring_buffer *ring_buffer_init(uint32_t capacity, size_t item_size);
void ring_buffer_destroy(struct ring_buffer *ring);
uint32_t ring_buffer_write(struct ring_buffer *ring, const void *data,
                           uint32_t items);
uint32_t ring_buffer_wait_read(struct ring_buffer *ring, void *data,
                               uint32_t items);
void ring_buffer_close(struct ring_buffer *ring);



enum TransportStreamType
{
    Stream_Control,
    Stream_Video,
    Stream_Audio,
    Stream_Input
};

enum VideoMessageType
{
    Codec_Decsription,
    Codec_Payload
};

// Mail Box Thread Communication:
struct Letter
{
    enum TransportStreamType Stream;
    enum VideoMessageType MessageType;
    void* Data;
    int DataLength;
};

struct MailBox_Transport
{
    struct Letter Letter[500];
    int LetterCount;
    int LetterMax;
};


// Putting Cross Module Singletons here for now.
// TODO: Move to Session struct before merging.
static struct MailBox_Transport* StaticTransportMailbox = NULL;
static pthread_mutex_t StaticMailBoxMutex;

void SendTransportMail(enum TransportStreamType Stream, enum VideoMessageType MessageType, void* Data, int length);

struct Letter* CheckMail();

#endif
