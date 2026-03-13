#pragma once
#include <pthread.h>
#include <Transport.h>

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