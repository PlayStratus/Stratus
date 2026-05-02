#include <assert.h>
#include <semaphore.h>
#include <stdio.h>
#include <stdlib.h>

#include "rbuf2.h"

/*
 * Contains ring buffer data
 *
 * EXAMPLE STATES:
 *
 * (1) The ring buffer is empty.
 *
 *      |0|1|2|3|4|5|6|7|8|9|
 *       |                 |
 *       +- HEAD           +- TAIL
 *
 * (2) The producer has pushed five values (0, 1, 2, 3, and 4) and the consumer
 *     has popped three values (0, 1, and 2). The consumer currently "owns"
 *     entries 3 and 4.
 *
 *      |0|1|2|3|4|5|6|7|8|9|
 *           |     |
 *           |     +- HEAD
 *           +- TAIL
 *
 * (3) The ring buffer is full.
 *
 *      |0|1|2|3|4|5|6|7|8|9|
 *       |
 *       +- HEAD
 *       +- TAIL
 */
struct rbuf {
    int size;              // Total entries (usable capacity is one less)
    int head;              // Index of next entry to be pushed
    int tail;              // Index of last entry popped
    void **entries;        // The ring buffer entries
    sem_t sem;             // A semaphore to avoid busy waiting in consumer thread
    rbuf_entry_free *free; // Function used to free used entries
};

/*
 * Initializes a ring buffer.
 *
 * Note that the consumer still must call rbuf_set_free before the rbuf_push may
 * be called.
 *
 * Returns 0 on success and -1 on failure.
 */
struct rbuf *rbuf_init(int capacity) {
    struct rbuf *buf;

    assert(capacity > 0);

    buf = calloc(1, sizeof(struct rbuf));
    if (buf == NULL) {
        perror("[Common] calloc");
        return NULL;
    }
    buf->size = capacity + 1;
    buf->head = 0;
    buf->tail = buf->size - 1;
    assert(sem_init(&buf->sem, 0, 0) == 0); // sem_init should not fail
    buf->free = NULL;

    buf->entries = calloc(buf->size, sizeof(void *));
    if (buf->entries == NULL) {
        free(buf);
        sem_destroy(&buf->sem);
        perror("[Common] calloc");
        return NULL;
    }

    return buf;
}

/*
 * Configure a callback function to free expired ring buffer entries
 */
void rbuf_set_free(struct rbuf *buf, rbuf_entry_free *free) {
    assert(free != NULL);
    buf->free = free;
}

/*
 * Destroy a ring buffer and free its resources
 */
void rbuf_destroy(struct rbuf *buf) {
    for (int i = 0; i < buf->size; i++) {
        if (buf->free != NULL && buf->entries[i] != NULL)
            buf->free(buf->entries[i]);
    }
    sem_destroy(&buf->sem);
    free(buf->entries);
    free(buf);
}

/*
 * Free expired ring buffer entries
 */
void rbuf_free_expired(struct rbuf *buf) {
    int i, idx;

    assert(buf->free != NULL);

    if (buf->entries[buf->tail] != NULL) {
        // There are expired entries to be freed

        for (i = 1; i < buf->size - rbuf_used_capacity(buf); i++) {
            idx = (buf->head + i) % buf->size;
            if (buf->entries[idx] != NULL) {
                buf->free(buf->entries[idx]);
                buf->entries[idx] = NULL;
            }
        }
    }
}

/*
 * Push a non-NULL entry to the ring buffer
 *
 * Returns 0 on success and -1 on failure.
 */
int rbuf_push(struct rbuf *buf, void *data) {
    // Ensure data is not NULL and ring buffer is not full
    assert(data != NULL);
    if (rbuf_free_capacity(buf) == 0) {
        // Ring buffer is full
        fprintf(stderr, "[Common] ring buffer full\n");
        return -1;
    }

    rbuf_free_expired(buf);

    // Update head ptr after inserting data to avoid consumer reading NULL
    buf->entries[buf->head] = data;
    buf->head = (buf->head + 1) % buf->size;
    sem_post(&buf->sem);

    return 0;
}

/*
 * Wait for the ring buffer to become non-empty
 */
static void _rbuf_wait(struct rbuf *buf) {
    sem_wait(&buf->sem);
    sem_post(&buf->sem); // sem_wait decrements buf->sem, so we must reset it
}

/*
 * Pop all entries in the ring buffer except the latest one
 */
static void _rbuf_pop_old(struct rbuf *buf) {
    while (rbuf_used_capacity(buf) > 1)
        rbuf_pop(buf);
}

/*
 * Return the latest entry in the ring buffer after poping all older entries
 *
 * If the ring buffer is empty, a NULL pointer will be returned.
 */
static void *_rbuf_peak(struct rbuf *buf) {
    if (rbuf_used_capacity(buf) == 0)
        return NULL;

    void *data = buf->entries[(buf->tail + 1) % buf->size];
    assert(data != NULL);
    return data;
}


/*
 * Return the next entry in the ring buffer
 *
 * If no such entry is available, a NULL pointer will be returned.
 */
void *rbuf_try_peak(struct rbuf *buf) {
    return _rbuf_peak(buf);
}

/*
 * Return the next entry in the ring buffer
 *
 * This function will block until the ring buffer is non empty.
 */
void *rbuf_wait_peak(struct rbuf *buf) {
    _rbuf_wait(buf);
    void *data = _rbuf_peak(buf);
    assert(data != NULL);
    return data;
}

/*
 * Pop all older entries and then return the latest entry without popping it
 *
 * If no such entry is available, a NULL pointer will be returned.
 */
void *rbuf_try_peak_latest(struct rbuf *buf) {
    _rbuf_pop_old(buf);
    return _rbuf_peak(buf);
}

/*
 * Pop all older entries and then return the latest entry without popping it
 *
 * This function will block until the ring buffer is non empty.
 */
void *rbuf_wait_peak_latest(struct rbuf *buf) {
    _rbuf_wait(buf);
    _rbuf_pop_old(buf);
    void *data = _rbuf_peak(buf);
    assert(data != NULL);
    return data;
}

/*
 * Pop the next entry in the ring buffer
 *
 * The ring buffer must not be empty. Use rbuf_peak to wait for the ring buffer
 * to be non-empty.
 */
void rbuf_pop(struct rbuf *buf) {
    sem_wait(&buf->sem);
    assert(rbuf_used_capacity(buf) > 0);

    buf->tail = (buf->tail + 1) % buf->size;
}

/*
 * Compute the number of active entries in the ring buffer
 */
int rbuf_used_capacity(struct rbuf *buf) {
    return (buf->head - buf->tail - 1 + buf->size) % buf->size;
}

/*
 * Compute the number of active entries in the ring buffer
 */
int rbuf_free_capacity(struct rbuf *buf) {
    return buf->size - rbuf_used_capacity(buf) - 1;
}
