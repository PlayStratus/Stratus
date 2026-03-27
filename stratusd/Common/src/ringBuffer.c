/*
 * Thread-safe fixed-size-item ring buffer for inter-thread exchange.
 * This implementation allows overwriting unread items when writing new items,
 * so the newest items are always retained. When the input itself is larger than
 * the buffer capacity, only the newest capacity-sized suffix is retained.
 */
#include "Common.h"

#include <pthread.h>
#include <stdlib.h>
#include <string.h>

struct ring_buffer {
    unsigned char *buffer;

    uint32_t capacity;        // Total number of items the buffer can hold
    size_t item_size;         // Size of each item in bytes
    uint32_t read_pos;        // Index of the next item to read
    uint32_t write_pos;       // Index of the next item to write
    uint32_t items_available; // Number of items currently in the buffer

    int closed;
    pthread_mutex_t lock;
    pthread_cond_t readable;
};

static uint32_t ring_buffer_items_free(const struct ring_buffer *ring) {
    return ring->capacity - ring->items_available;
}

static void ring_buffer_drop_oldest_locked(struct ring_buffer *ring,
                                           uint32_t items) {
    if (items > ring->items_available)
        items = ring->items_available;

    if (items == 0)
        return;

    ring->read_pos = (ring->read_pos + items) % ring->capacity;
    ring->items_available -= items;
}

static void ring_buffer_copy_items(void *dst, const void *src, uint32_t items,
                                   size_t item_size) {
    memcpy(dst, src, (size_t)items * item_size);
}

static uint32_t ring_buffer_read_locked(struct ring_buffer *ring, void *data,
                                        uint32_t items) {
    unsigned char *dst;
    uint32_t items_to_read;
    uint32_t first_chunk_items;
    uint32_t second_chunk_items;

    if (data == NULL || items == 0)
        return 0;

    items_to_read = items;
    if (items_to_read > ring->items_available)
        items_to_read = ring->items_available;

    if (items_to_read == 0)
        return 0;

    dst = data;
    first_chunk_items = ring->capacity - ring->read_pos;
    if (first_chunk_items > items_to_read)
        first_chunk_items = items_to_read;

    second_chunk_items = items_to_read - first_chunk_items;

    ring_buffer_copy_items(
        dst, &ring->buffer[(size_t)ring->read_pos * ring->item_size],
        first_chunk_items, ring->item_size);
    if (second_chunk_items > 0) {
        ring_buffer_copy_items(
            &dst[(size_t)first_chunk_items * ring->item_size], ring->buffer,
            second_chunk_items, ring->item_size);
    }

    ring->read_pos = (ring->read_pos + items_to_read) % ring->capacity;
    ring->items_available -= items_to_read;

    return items_to_read;
}

/*
 * Initializes a ring buffer with the specified capacity and item size
 */

struct ring_buffer *ring_buffer_init(uint32_t capacity, size_t item_size) {
    struct ring_buffer *ring;

    if (capacity == 0 || item_size == 0)
        return NULL;

    ring = calloc(1, sizeof(*ring));
    if (ring == NULL)
        return NULL;

    ring->buffer = malloc((size_t)capacity * item_size);
    if (ring->buffer == NULL) {
        free(ring);
        return NULL;
    }

    ring->capacity = capacity;
    ring->item_size = item_size;

    if (pthread_mutex_init(&ring->lock, NULL) != 0) {
        free(ring->buffer);
        free(ring);
        return NULL;
    }

    if (pthread_cond_init(&ring->readable, NULL) != 0) {
        pthread_mutex_destroy(&ring->lock);
        free(ring->buffer);
        free(ring);
        return NULL;
    }

    return ring;
}

void ring_buffer_destroy(struct ring_buffer *ring) {
    if (ring == NULL)
        return;

    pthread_cond_destroy(&ring->readable);
    pthread_mutex_destroy(&ring->lock);
    free(ring->buffer);
    free(ring);
}

/**
 * Writes items to the ring buffer. If needed, the oldest unread items are
 * discarded so the newest items can always be written. When the input itself
 * is larger than the buffer capacity, only the newest capacity-sized suffix
 * is retained. Returns the number of input items copied into the buffer, or 0
 * if the buffer is closed.
 * @ring: The ring buffer to write to.
 * @data: Pointer to the data to write. Must point to a contiguous block of
 *        memory containing the items to write.
 * @items: The number of items to write.
 * @returns: The number of items actually written to the buffer.
 */
uint32_t ring_buffer_write(struct ring_buffer *ring, const void *data,
                           uint32_t items) {
    const unsigned char *src;
    uint32_t items_to_write;
    uint32_t items_to_skip;
    uint32_t items_to_drop;
    uint32_t first_chunk_items;
    uint32_t second_chunk_items;

    if (ring == NULL || data == NULL || items == 0)
        return 0;

    pthread_mutex_lock(&ring->lock);

    // If the buffer is closed, we can't write anything
    if (ring->closed) {
        pthread_mutex_unlock(&ring->lock);
        return 0;
    }

    items_to_write = items;
    items_to_skip = 0;
    if (items_to_write > ring->capacity) {
        items_to_skip = items_to_write - ring->capacity;
        items_to_write = ring->capacity;
    }

    items_to_drop = 0;
    if (items_to_write > ring_buffer_items_free(ring)) {
        items_to_drop = items_to_write - ring_buffer_items_free(ring);
        ring_buffer_drop_oldest_locked(ring, items_to_drop);
    }

    src =
        &((const unsigned char *)data)[(size_t)items_to_skip * ring->item_size];
    first_chunk_items = ring->capacity - ring->write_pos;
    if (first_chunk_items > items_to_write)
        first_chunk_items = items_to_write;

    second_chunk_items = items_to_write - first_chunk_items;

    // Copy the items to the ring buffer
    ring_buffer_copy_items(
        &ring->buffer[(size_t)ring->write_pos * ring->item_size], src,
        first_chunk_items, ring->item_size);

    // If we wrapped around, copy the remaining items to the beginning of the
    // buffer
    if (second_chunk_items > 0) {
        ring_buffer_copy_items(
            ring->buffer, &src[(size_t)first_chunk_items * ring->item_size],
            second_chunk_items, ring->item_size);
    }

    ring->write_pos = (ring->write_pos + items_to_write) % ring->capacity;
    ring->items_available += items_to_write;

    pthread_cond_signal(&ring->readable);
    pthread_mutex_unlock(&ring->lock);

    return items_to_write;
}

/**
 * Waits for items to be available for reading from the ring buffer and reads
 * them. Returns the number of items actually read.
 */
uint32_t ring_buffer_wait_read(struct ring_buffer *ring, void *data,
                               uint32_t items) {
    uint32_t items_to_read;

    if (ring == NULL || data == NULL || items == 0)
        return 0;

    pthread_mutex_lock(&ring->lock);
    while (ring->items_available == 0 && !ring->closed) {
        pthread_cond_wait(&ring->readable, &ring->lock);
    }

    items_to_read = ring_buffer_read_locked(ring, data, items);
    pthread_mutex_unlock(&ring->lock);

    return items_to_read;
}

void ring_buffer_close(struct ring_buffer *ring) {
    if (ring == NULL)
        return;

    pthread_mutex_lock(&ring->lock);
    ring->closed = 1;
    pthread_cond_broadcast(&ring->readable);
    pthread_mutex_unlock(&ring->lock);
}
