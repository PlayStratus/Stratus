#ifndef COMMON_H
#define COMMON_H

#include <stddef.h>
#include <stdint.h>
#include <pthread.h>

// Necessary for C++ support for C Atomics on GCC
#ifdef __cplusplus
#include <atomic>
using namespace std;
#else
#include <stdatomic.h>
#endif

struct ring_buffer;

struct ring_buffer *ring_buffer_init(uint32_t capacity, size_t item_size);
void ring_buffer_destroy(struct ring_buffer *ring);
uint32_t ring_buffer_write(struct ring_buffer *ring, const void *data,
                           uint32_t items);
uint32_t ring_buffer_wait_read(struct ring_buffer *ring, void *data,
                               uint32_t items);
void ring_buffer_close(struct ring_buffer *ring);

enum TransportMessageType
{
    Video_KeyFrame,
    Video_IntermediateFrame,
    Input_GamepadStateUpdate
};

struct TransportMessage
{
    enum TransportMessageType Type;
    void* Data;
    size_t Length;
};

struct TransportMessageQueue
{
    struct TransportMessage* Messages;
    atomic_int Consumer;
    atomic_int Producer;
    int MaxMessageCount;
};

struct TransportMessageQueue* ConstructTransportMessageQueue(int MaxMessageCount);
void DestroyTransportMessageQueue(struct TransportMessageQueue* MessageQueue);
void SendTransportMessage(struct TransportMessageQueue* MessageQueue, enum TransportMessageType MessageType, void* Data, size_t Length);
struct TransportMessage* RecieveTransportMessage(struct TransportMessageQueue* MessageQueue);
#endif
