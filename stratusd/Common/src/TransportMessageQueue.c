#include "Common.h"
#include <string.h>
#include <stdlib.h>
#include <stdatomic.h>
#include <stdio.h>

struct TransportMessageQueue* ConstructTransportMessageQueue(int MaxMessageCount)
{
    struct TransportMessageQueue* MessageQueue = malloc(sizeof(struct TransportMessageQueue)); 

    MessageQueue->Messages = malloc(sizeof(struct TransportMessage) * MaxMessageCount);
    
    atomic_init(&MessageQueue->Producer, 0);
    atomic_init(&MessageQueue->Consumer, 0);
    MessageQueue->MaxMessageCount = MaxMessageCount;

    return MessageQueue;
}

void SendTransportMessage(struct TransportMessageQueue* MessageQueue, enum TransportMessageType MessageType, void* Data, size_t Length)
{
    int currentProducer = atomic_load_explicit(&MessageQueue->Producer, memory_order_relaxed);
    int currentConsumer = atomic_load_explicit(&MessageQueue->Consumer, memory_order_acquire);

    int nextProducer = (currentProducer + 1) % MessageQueue->MaxMessageCount;

    if (nextProducer == currentConsumer)
    {
        printf("[Common] TransportMessageQueue full! Dropping Message.\n");
        return; 
    }

    void* DataCopy = malloc(Length);
    memcpy(DataCopy, Data, Length);
    
    MessageQueue->Messages[currentProducer].Data = DataCopy;
    MessageQueue->Messages[currentProducer].Length = Length;
    MessageQueue->Messages[currentProducer].Type = MessageType;

    atomic_store_explicit(&MessageQueue->Producer, nextProducer, memory_order_release);
}

struct TransportMessage* RecieveTransportMessage(struct TransportMessageQueue* MessageQueue)
{
    int currentConsumer = atomic_load_explicit(&MessageQueue->Consumer, memory_order_relaxed);
    int currentProducer = atomic_load_explicit(&MessageQueue->Producer, memory_order_acquire);

    // Queue is empty. 
    if (currentConsumer == currentProducer)
    {
        return NULL;
    }

    struct TransportMessage* MessageToReturn = &MessageQueue->Messages[currentConsumer];

    int nextConsumer = (currentConsumer + 1) % MessageQueue->MaxMessageCount;
    atomic_store_explicit(&MessageQueue->Consumer, nextConsumer, memory_order_release);

    return MessageToReturn;
}