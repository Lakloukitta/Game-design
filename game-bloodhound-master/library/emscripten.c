#include "math.h"
#include "sdl_wrapper.h"
#include "state.h"
#include <stdio.h>
#include <stdlib.h>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

state_t *state;

void loop() {
  if (!state) {
    state = emscripten_init();
  }

  emscripten_main(state);

  if (sdl_is_done()) {      
    emscripten_free(state); 
#ifdef __EMSCRIPTEN__ 
    emscripten_cancel_main_loop();
    emscripten_force_exit(0);
#else
    exit(0);
#endif
    return;
  }
}

int main() {
#ifdef __EMSCRIPTEN__
  // Set loop as the function emscripten calls to request a new frame
  emscripten_set_main_loop_arg(loop, NULL, 0, 1);
#else
  while (1) {
    loop();
  }
#endif
}
