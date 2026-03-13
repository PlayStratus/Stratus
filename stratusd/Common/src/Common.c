#include "Common.h"
#include <stdlib.h>
#include <assert.h>
#include <string.h>

void SendTransportMail(enum TransportStreamType Stream, enum VideoMessageType MessageType, void* Data, int length)
{
    if (!StaticTransportMailbox)
    {
        StaticTransportMailbox = malloc(sizeof(StaticTransportMailbox));

        StaticTransportMailbox->LetterCount = 0;
        StaticTransportMailbox->LetterMax = 500;
    }

    pthread_mutex_lock(&StaticMailBoxMutex);

    //assert(StaticTransportMailbox->LetterCount >= StaticTransportMailbox->LetterMax);

    StaticTransportMailbox->Letter[StaticTransportMailbox->LetterCount].Stream = Stream;
    StaticTransportMailbox->Letter[StaticTransportMailbox->LetterCount].MessageType = MessageType;
    void* DataPTR = malloc(length);
    memcpy(DataPTR, Data, length);

    StaticTransportMailbox->Letter[StaticTransportMailbox->LetterCount].Data = DataPTR;
    StaticTransportMailbox->Letter[StaticTransportMailbox->LetterCount].DataLength = length;

    StaticTransportMailbox->LetterCount++;
    pthread_mutex_unlock(&StaticMailBoxMutex);
}

struct Letter* CheckMail()
{
    if (!StaticTransportMailbox)
    {
        StaticTransportMailbox = malloc(sizeof(struct MailBox_Transport));

        pthread_mutex_init(&StaticMailBoxMutex, NULL);
        
        StaticTransportMailbox->LetterCount = 0;
        StaticTransportMailbox->LetterMax = 500;
    }

    pthread_mutex_lock(&StaticMailBoxMutex);

    if (StaticTransportMailbox->LetterCount == 0)
    {
        pthread_mutex_unlock(&StaticMailBoxMutex);
        return NULL;
    }
    
    struct Letter* CurrentLetter = malloc(sizeof(struct Letter));

    memcpy(CurrentLetter, &StaticTransportMailbox->Letter[StaticTransportMailbox->LetterCount - 1], sizeof(struct Letter));

    StaticTransportMailbox->LetterCount--;

    pthread_mutex_unlock(&StaticMailBoxMutex);

    return CurrentLetter;
}