/*
 * Backend-stratusd API implementation
 *
 * Handles all of the WebSocket logistics and JSON de/serializing for API
 * messages.
 */

#include <assert.h>
#include <cjson/cJSON.h>
#include <poll.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "api.h"
#include "sidecar-priv.h"

// Forward declarations needed by api_recv()
static int api_recv_start_session(struct api_client *client, cJSON *payload);
static int api_recv_stop_session(struct api_client *client, cJSON *payload);

/*
 * Whether to log all incoming and outgoing API messages
 *
 * Set in api_init according to the STRATUSD_API_DEBUG variable.
 */
static bool api_debug = false;

/*
 * Get the current timestamp in "YYYY-mm-dd HH:MM:SS" format
 *
 * Returns a pointer to the timestamp string on success and NULL on failure.
 */
static char *get_timestamp() {
    char *result;
    time_t t;
    struct tm *tmp;

    const char timestamp_len = strlen("YYYY-mm-dd HH:MM:SS") + 1;

    result = malloc(timestamp_len);
    if (result == NULL) {
        perror("[Sidecar] malloc");
        goto err_malloc;
    }

    t = time(NULL);
    tmp = localtime(&t);
    if (tmp == NULL) {
        perror("[Sidecar] localtime");
        goto err_localtime;
    }

    if (strftime(result, timestamp_len, "%Y-%m-%d %H:%M:%S", tmp) == 0) {
        perror("[Sidecar] strftime");
        goto err_strftime;
    }

    return result;

err_strftime:
    free(tmp);
err_localtime:
    free(result);
err_malloc:
    return NULL;
}

/*
 * Get a random version 4 UUID
 *
 * Returns a pointer to the UUID string on success and NULL on failure.
 */
static char *get_uuid() {
    char *result;

    const char *uuid_format = "01234567-89ab-Xdef-Y123-456789abcdef";

    result = malloc(UUID_LEN);
    if (result == NULL) {
        perror("[Sidecar] malloc");
        return NULL;
    }

    for (int i = 0; i < UUID_LEN; i++) {
        if (i == UUID_LEN - 1) {
            result[i] = '\0';
        } else if (uuid_format[i] == '-') {
            result[i] = '-';
        } else if (uuid_format[i] == 'X') {
            // Set 4-bit version to 4 (0b0100)
            result[i] = '4';
        } else if (uuid_format[i] == 'Y') {
            // Set 2-bit variant to 1 (0b01XX)
            result[i] = "89ab"[arc4random() % 4];
        } else {
            result[i] = "0123456789abcdef"[arc4random() % 16];
        }
    }

    return result;
}

/*
 * Initialize an API client
 *
 * The URL of the backend WebSocket server must be set in the
 * STRATUSD_BACKEND_URL environment variable.
 *
 * Returns the client struct on success and NULL on failure.
 */
struct api_client *api_init() {
    char *url;
    struct api_client *client;
    CURLcode ret;

    url = getenv("STRATUSD_BACKEND_URL");
    assert(url != NULL);

    api_debug = (getenv("STRATUSD_API_DEBUG") != NULL);

    // Initialize client
    client = malloc(sizeof(struct api_client));
    if (client == NULL) {
        perror("[Sidecar] malloc");
        goto err_malloc;
    }
    client->on_start_session = NULL;
    client->on_stop_session = NULL;
    client->userdata = NULL;

    // Initialize curl handle
    client->curl = curl_easy_init();
    if (client->curl == NULL) {
        perror("[Sidecar] curl_easy_init");
        goto err_init;
    }
    assert(curl_easy_setopt(client->curl, CURLOPT_URL, url) == CURLE_OK);
    assert(curl_easy_setopt(client->curl, CURLOPT_CONNECT_ONLY, 2) == CURLE_OK);

    // Connect to backend server and get socket fd
    ret = curl_easy_perform(client->curl);
    if (ret != CURLE_OK) {
        fprintf(stderr, "[Sidecar] curl_easy_perform: %s\n",
                curl_easy_strerror(ret));
        goto err_post_init;
    }
    ret = curl_easy_getinfo(client->curl, CURLINFO_ACTIVESOCKET, &client->fd);
    if (ret != CURLE_OK || client->fd == CURL_SOCKET_BAD) {
        fprintf(stderr, "[Sidecar] curl_easy_getinfo: %s\n",
                curl_easy_strerror(ret));
        goto err_post_init;
    }

    return client;

err_post_init:
    curl_easy_cleanup(client->curl);
err_init:
    free(client);
err_malloc:
    return NULL;
}

/*
 * Send a raw API message
 *
 * Returns 0 on success and -1 on failure.
 */
static int api_send(struct api_client *client, char *msg) {
    CURLcode ret;
    size_t size, sent, cum_sent;

    if (api_debug)
        fprintf(stderr, "[Sidecar] Sending API message: %s\n", msg);

    size = strlen(msg);
    cum_sent = 0;
    while (cum_sent < size) {
        ret = curl_ws_send(client->curl, msg + cum_sent, size - cum_sent, &sent,
                           0, CURLWS_TEXT);
        if (ret != CURLE_OK) {
            fprintf(stderr, "[Sidecar] curl_ws_send: %s\n",
                    curl_easy_strerror(ret));
            return -1;
        }
        cum_sent += sent;
    }

    return 0;
}

/*
 * Send a JSON payload as an API message
 *
 * Returns 0 on success and -1 on failure.
 */
static int api_send_json(struct api_client *client, char *msg_type,
                         cJSON *payload) {
    int ret;
    char *json, *timestamp, *uuid;
    cJSON *msg;

    if ((timestamp = get_timestamp()) == NULL)
        goto err_timestamp;
    if ((uuid = get_uuid()) == NULL)
        goto err_uuid;

    if ((msg = cJSON_CreateObject()) == NULL)
        goto err_cjson;
    if (cJSON_AddStringToObject(msg, "type", msg_type) == NULL)
        goto err_cjson;
    if (cJSON_AddStringToObject(msg, "timestamp", timestamp) == NULL)
        goto err_cjson;
    if (cJSON_AddStringToObject(msg, "request_id", uuid) == NULL)
        goto err_cjson;
    if (cJSON_AddItemToObject(msg, "payload", payload) == 0)
        goto err_cjson;
    payload = NULL;

    if ((json = cJSON_Print(msg)) == NULL)
        goto err_cjson;
    ret = api_send(client, json);

    cJSON_Delete(msg);
    free(json);
    free(timestamp);
    free(uuid);

    return ret;

err_cjson:
    fprintf(stderr, "[Sidecar] A cJSON error occurred while creating a "
            "message\n");
    cJSON_Delete(msg);
err_timestamp:
    free(timestamp);
err_uuid:
    free(uuid);
    cJSON_Delete(payload);
    return -1;
}

/*
 * Parse a raw API message and call the appropriate handlers
 *
 * TODO: Make static (currently non-static for testing purposes).
 *
 * Returns 0 on success, -1 on fatal failure, and -2 on message parsing errors.
 */
int api_recv(struct api_client *client, char *msg) {
    int ret;
    cJSON *json, *type, *payload;

    if (api_debug)
        fprintf(stderr, "[Sidecar] Received API message: %s\n", msg);

    // Parse JSON message
    json = cJSON_Parse(msg);
    if (json == NULL) {
        fprintf(stderr, "[Sidecar] cJSON_Parse: Error before \"%s\"\n",
                cJSON_GetErrorPtr());
        goto err;
    }

    type = cJSON_GetObjectItemCaseSensitive(json, "type");
    if (!cJSON_IsString(type)) {
        fprintf(stderr, "[Sidecar] Error: received message with invalid type\n");
        goto err;
    }

    payload = cJSON_GetObjectItemCaseSensitive(json, "payload");
    if (!cJSON_IsObject(payload)) {
        fprintf(stderr, "[Sidecar] Error: received message without payload\n");
        goto err;
    }

    if (!strcmp(type->valuestring, "start_session")) {
        ret = api_recv_start_session(client, payload);
    } else if (!strcmp(type->valuestring, "stop_session")) {
        ret = api_recv_stop_session(client, payload);
    } else if ((!strcmp(type->valuestring, "heartbeat")) ||
               (!strcmp(type->valuestring, "confirm_start")) ||
               (!strcmp(type->valuestring, "session_error"))) {
        fprintf(stderr, "[Sidecar] Error: received unexpected %s message from "
                "backend\n", type->valuestring);
        goto err;
    } else {
        fprintf(stderr, "[Sidecar] Error: received message of unknown type "
                "\"%s\"\n", type->valuestring);
        goto err;
    }

    cJSON_Delete(json);

    return ret;

err:
    cJSON_Delete(json);
    return -2;
}

/*
 * Receive and process new API messages
 *
 * Returns 0 on success, -1 on fatal failure, and -2 on message parsing errors.
 */
int api_poll(struct api_client *client, int timeout) {
    int events;
    size_t size;
    char buf[4096];
    struct pollfd fd;
    CURLcode ret;
    const struct curl_ws_frame *meta;

    // Check for new data on file descriptor
    fd.fd = client->fd;
    fd.events = POLLIN;
    fd.revents = 0;
    events = poll(&fd, 1, timeout);
    if (events < 0) {
        perror("[Sidecar] poll");
        return -1;
    } else if (events == 0) {
        // No new data
        return 0;
    }

    // Read new data into buffer
    ret = curl_ws_recv(client->curl, buf, 4096, &size, &meta);
    if (ret != CURLE_OK) {
        fprintf(stderr, "[Sidecar] curl_ws_recv: %s\n",
                curl_easy_strerror(ret));
        return -1;
    } else if (meta->bytesleft != 0) {
        // We're using a fixed buffer size for simplicity, but 4K should be more
        // than enough the messages we'll be receiving.
        fprintf(stderr, "[Sidecar] Error: received message is longer than 4096 "
                "bytes\n");
        return -1;
    }
    buf[size] = '\0';

    return api_recv(client, buf);
}

/*
 * Free the resources associated with an API client
 */
void api_teardown(struct api_client *client) {
    curl_easy_cleanup(client->curl);
    free(client);
}

/*
 * Send a heartbeat message
 *
 * Returns 0 on success and -1 on failure.
 */
int api_send_heartbeat(struct api_client *client,
                       struct api_msg_heartbeat *data) {
    int i;
    cJSON *payload, *games, *game, *sessions, *session;

    if ((payload = cJSON_CreateObject()) == NULL)
        goto err_cjson;
    if (cJSON_AddStringToObject(payload, "hostname", data->hostname) == NULL)
        goto err_cjson;
    if (cJSON_AddStringToObject(payload, "ip", data->ip) == NULL)
        goto err_cjson;
    if (cJSON_AddStringToObject(payload, "version", data->version) == NULL)
        goto err_cjson;

    if ((games = cJSON_AddArrayToObject(payload, "games")) == NULL)
        goto err_cjson;
    for (i = 0; data->games[i] != NULL; i++) {
        if ((game = cJSON_CreateString(data->games[i])) == NULL)
            goto err_cjson;
        cJSON_AddItemToArray(games, game);
    }

    if ((sessions = cJSON_AddArrayToObject(payload, "sessions")) == NULL)
        goto err_cjson;
    for (i = 0; data->sessions[i] != NULL; i++) {
        if ((session = cJSON_CreateString(data->sessions[i])) == NULL)
            goto err_cjson;
        cJSON_AddItemToArray(sessions, session);
    }

    if (cJSON_AddNumberToObject(payload, "uptime", data->uptime) == NULL)
        goto err_cjson;

    if (cJSON_AddNumberToObject(payload, "cpu_load", data->cpu_load) == NULL)
        goto err_cjson;
    if (cJSON_AddNumberToObject(payload, "cpu_count", data->cpu_count) == NULL)
        goto err_cjson;

    if (cJSON_AddNumberToObject(payload, "ram_used", data->ram_used) == NULL)
        goto err_cjson;
    if (cJSON_AddNumberToObject(payload, "ram_total", data->ram_total) == NULL)
        goto err_cjson;

    if (cJSON_AddNumberToObject(payload, "disk_used", data->disk_used) == NULL)
        goto err_cjson;
    if (cJSON_AddNumberToObject(payload, "disk_total", data->disk_total) == NULL)
        goto err_cjson;

    if (cJSON_AddNumberToObject(payload, "temperature", data->temperature) == NULL)
        goto err_cjson;

    return api_send_json(client, "heartbeat", payload);

err_cjson:
    fprintf(stderr, "[Sidecar] A cJSON error occurred while creating a "
            "heartbeat message\n");
    cJSON_Delete(payload);
    return -1;
}

/*
 * Process a parsed start message and call the appropriate handlers
 *
 * Returns 0 on success, -1 on fatal failure, and -2 on message parsing errors.
 */
static int api_recv_start_session(struct api_client *client, cJSON *payload) {
    struct api_msg_start_session data;
    cJSON *field;

    field = cJSON_GetObjectItemCaseSensitive(payload, "session_id");
    if (!cJSON_IsString(field))
        goto err;
    data.session_id = field->valuestring;

    field = cJSON_GetObjectItemCaseSensitive(payload, "game_id");
    if (!cJSON_IsString(field))
        goto err;
    data.game_id = field->valuestring;

    field = cJSON_GetObjectItemCaseSensitive(payload, "width");
    if (!cJSON_IsNumber(field))
        goto err;
    data.width = field->valueint;

    field = cJSON_GetObjectItemCaseSensitive(payload, "height");
    if (!cJSON_IsNumber(field))
        goto err;
    data.height = field->valueint;

    // TODO: parse session_token once sent by backend
    // field = cJSON_GetObjectItemCaseSensitive(payload, "session_token");
    // if (!cJSON_IsString(field))
    //     goto err;
    // data.session_token = field->valuestring;
    data.session_token = NULL;

    field = cJSON_GetObjectItemCaseSensitive(payload, "user_id");
    if (!cJSON_IsString(field))
        goto err;
    data.user_id = field->valuestring;

    field = cJSON_GetObjectItemCaseSensitive(payload, "user_name");
    if (!cJSON_IsString(field))
        goto err;
    data.user_name = field->valuestring;

    if (client->on_start_session != NULL)
        return client->on_start_session(client->userdata, &data);

    return 0;

err:
    fprintf(stderr, "[Sidecar] Error: received invalid start message\n");
    return -2;
}

/*
 * Send a confirm start message
 *
 * Returns 0 on success and -1 on failure.
 */
int api_send_confirm_start(struct api_client *client, char *session_id,
                           char *tls_fingerprint) {
    cJSON *payload;

    if ((payload = cJSON_CreateObject()) == NULL)
        goto err_cjson;

    if (cJSON_AddStringToObject(payload, "session_id", session_id) == NULL)
        goto err_cjson;

    if (cJSON_AddStringToObject(payload, "tls_fingerprint", tls_fingerprint) ==
        NULL)
      goto err_cjson;

    return api_send_json(client, "start_confirmed", payload);

err_cjson:
    fprintf(stderr, "[Sidecar] A cJSON error occurred while creating a "
            "confirm_start message\n");
    cJSON_Delete(payload);
    return -1;
}

/*
 * Process a parsed stop message and call the appropriate handlers
 *
 * Returns 0 on success, -1 on fatal failure, and -2 on message parsing errors.
 */
static int api_recv_stop_session(struct api_client *client, cJSON *payload) {
    char *session_id;
    cJSON *field;

    field = cJSON_GetObjectItemCaseSensitive(payload, "session_id");
    if (!cJSON_IsString(field))
        goto err;
    session_id = field->valuestring;

    if (client->on_stop_session != NULL)
        return client->on_stop_session(client->userdata, session_id);

    return 0;

err:
    fprintf(stderr, "[Sidecar] Error: received invalid stop message\n");
    return -2;
}

/*
 * Send a stop session message
 *
 * Returns 0 on success and -1 on failure.
 */
int api_send_stop_session(struct api_client *client, char *session_id) {
    cJSON *payload;

    if ((payload = cJSON_CreateObject()) == NULL)
        goto err_cjson;

    if (cJSON_AddStringToObject(payload, "session_id", session_id) == NULL)
        goto err_cjson;

    return api_send_json(client, "stop_session", payload);

err_cjson:
    fprintf(stderr, "[Sidecar] A cJSON error occurred while creating a "
            "stop_session message\n");
    cJSON_Delete(payload);
    return -1;
}

/*
 * Send a session error message
 *
 * Returns 0 on success and -1 on failure.
 */
int api_send_session_error(struct api_client *client, char *session_id,
                           char *description) {
    cJSON *payload;

    if ((payload = cJSON_CreateObject()) == NULL)
        goto err_cjson;

    if (cJSON_AddStringToObject(payload, "session_id", session_id) == NULL)
        goto err_cjson;

    if (cJSON_AddStringToObject(payload, "description", description) == NULL)
        goto err_cjson;

    return api_send_json(client, "session_error", payload);

err_cjson:
    fprintf(stderr, "[Sidecar] A cJSON error occurred while creating a "
            "session_error message\n");
    cJSON_Delete(payload);
    return -1;
}
