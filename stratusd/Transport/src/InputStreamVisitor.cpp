#include <netinet/in.h>

#include "InputStreamVisitor.h"
#include "input-queue.h"

InputStreamVisitor::InputStreamVisitor(
    quic::WebTransportStream *stream, struct rbuf *queue) {

    this->stream = stream;
    this->queue = queue;
}

void InputStreamVisitor::OnCanRead() {
    std::string *buf = new std::string;
    webtransport::Stream::ReadResult ret = stream->Read(buf);

    struct input_queue_msg *msg = new input_queue_msg();
    msg->cpp_str = buf;
    msg->data = buf->c_str();
    msg->length = buf->length();
    rbuf_push(queue, (void*)msg);
}

// Not used:
void InputStreamVisitor::OnCanWrite() {}
void InputStreamVisitor::OnResetStreamReceived(
    webtransport::StreamErrorCode error) {}
void InputStreamVisitor::OnStopSendingReceived(
    webtransport::StreamErrorCode error) {}
void InputStreamVisitor::OnWriteSideInDataRecvdState() {}
