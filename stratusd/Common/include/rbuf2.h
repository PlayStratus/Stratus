#ifndef COMMON_RBUF2_H
#define COMMON_RBUF2_H

/*
 * This is an additional ring buffer implementation. Unlike the implementation
 * in ringBuffer.c, void pointers are used instead of double values. As a
 * result, the producer MUST register a "free" function that will run when
 * rbuf_free_expired or rbuf_push is called. Additionally, the following
 * requirements must be met:
 *
 * - Only two threads (one "producer" thread and one "consumer" thread) may use
 *   the shared buffer concurrently
 * - The producer must not call rbuf_peak or rbuf_pop
 * - The producer must call rbuf_set_free before the first call to rbuf_push and
 *   cannot pass NULL values to rbuf_push
 * - The producer must not access pointers after they're passed to rbuf_push
 * - The consumer must not call rbuf_push, rbuf_set_free, or rbuf_free_expired
 * - The consumer must not access pointers after they've been popped
 */

struct rbuf;

typedef void (rbuf_entry_free)(void *entry);

// Lifecycle functions
struct rbuf *rbuf_init(int capacity);
void rbuf_destroy(struct rbuf *buf);

// Producer-only functions
int rbuf_push(struct rbuf *buf, void *data);
void rbuf_set_free(struct rbuf *buf, rbuf_entry_free *free);
void rbuf_free_expired(struct rbuf *buf);

// Consumer-only functions
void *rbuf_wait_peak_latest(struct rbuf *buf);
void *rbuf_try_peak_latest(struct rbuf *buf);
void rbuf_pop(struct rbuf *buf);

// Shared functions
int rbuf_size(struct rbuf *buf);

#endif
