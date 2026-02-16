#ifndef INPUT_H
#define INPUT_H

struct input_session; // internal to Input module

struct input_session *input_init();

int input_run(struct input_session *session);

void input_destroy(struct input_session *session);

#endif
