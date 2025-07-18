#ifndef __STATE_H__
#define __STATE_H__
#include "math.h"
//#include "sdl_wrapper.h"
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include "scene.h"

typedef enum {GAME=0, MENU=1, STATS=2, INSTRUCTIONS=3} screen_t;
typedef enum {ALIVE = 0, DEAD=1, COMPLETE=2, PAUSE=3} end_game_t;
/**
 * Stores the demo state
 * Use this to store any variable needed every 'tick' of your demo
 */
typedef struct state {
  size_t points;
  double_t time;
  double_t timer;
  scene_t *scene;
  size_t round;
  screen_t screen; 
  size_t avg_pts;
  end_game_t end;
  vector_t  moving;
  vector_t  monster_v;
} state_t;

/**
 * Initializes sdl as well as the variables needed
 * Creates and stores all necessary variables for the demo in a created state
 * variable Returns the pointer to this state (This is the state emscripten_main
 * and emscripten_free work with)
 */
state_t *emscripten_init();

/**
 * Called on each tick of the program
 * Updates the state variables and display as necessary, depending on the time
 * that has passed.
 *
 * @param state pointer to a state object with info about demo
 * @return a boolean representing whether the game/demo is over
 */
bool emscripten_main(state_t *state);

/**
 * Frees anything allocated in the demo
 * Should free everything in state as well as state itself.
 *
 * @param state pointer to a state object with info about demo
 */
void emscripten_free(state_t *state);

#endif // #ifndef __STATE_H__
