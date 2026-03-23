#ifndef SIDECAR_PRIV_H
#define SIDECAR_PRIV_H

/*
 * The length of a UUID, NULL-terminator included
 */
#define UUID_LEN    37

/*
 * The default directory to search for games in
 */
#define DEFAULT_GAME_DIR "../games/build"

struct sidecar_context {
    struct api_client *api_client;
    struct session *active_session;
};

#endif
