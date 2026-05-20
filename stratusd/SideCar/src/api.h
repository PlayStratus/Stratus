#ifndef SIDECAR_API_H
#define SIDECAR_API_H

#include <curl/curl.h>

/*
 * Contains payload data for a heartbeat message
 */
struct api_msg_heartbeat {
    char *hostname;
    char *ip;
    char *version;

    char **games;       // NULL-terminated array of UUIDs
    char **sessions;    // NULL-terminated array of UUIDs

    long uptime;        // in seconds
    float cpu_load;     // 60 second load average
    int cpu_count;
    long ram_used;      // in bytes
    long ram_total;     // in bytes
    long disk_used;     // in bytes
    long disk_total;    // in bytes
    float temperature;  // in degrees Celsius
};

/*
 * Contains payload data for a start session message
 */
struct api_msg_start_session {
    char *session_id;       // UUID
    char *game_id;          // UUID
    int width;
    int height;
    char *session_token;
    char *user_id;          // UUID
    char *user_name;
};

/*
 * Signature of handler called when a start session message is received
 *
 * Should return 0 on success and -1 on failure.
 */
typedef int (api_start_session_msg_handler)(void *userdata,
                                            struct api_msg_start_session *data);

/*
 * Signature of handler called when a stop session message is received
 *
 * Should return 0 on success and -1 on failure.
 */
typedef int (api_stop_session_msg_handler)(void *userdata, char *session_id);

/*
 * Contains data for an instance of an API client
 *
 * Note that if the STRATUSD_BACKEND_URL environment variable is NULL, the curl
 * field will be set to NULL and the api_poll and api_send_* functions are
 * no-ops.
 */
struct api_client {
    api_start_session_msg_handler *on_start_session;
    api_stop_session_msg_handler *on_stop_session;
    void *userdata; // for external use by caller

    CURL *curl;
    int fd;
    time_t last_reconnect;
};

struct api_client *api_init();

int api_poll(struct api_client *client, int timeout);

// TODO: Make static (currently non-static for testing purposes)
int api_recv(struct api_client *client, char *msg);

void api_teardown(struct api_client *client);

int api_send_heartbeat(struct api_client *client,
                       struct api_msg_heartbeat *data);

int api_send_confirm_start(struct api_client *client, char *session_id,
                           char *tls_fingerprint);

int api_send_stop_session(struct api_client *client, char *session_id);

int api_send_session_error(struct api_client *client, char *session_id,
                           char *description);

#endif
