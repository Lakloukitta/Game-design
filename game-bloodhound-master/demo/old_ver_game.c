#include <assert.h>
#include <state.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <stdbool.h>
#include <string.h>
#include <time.h>
#include "collision.h"
#include "forces.h"
#include "asset.h"
#include "asset_cache.h"
#include "sdl_wrapper.h"

const vector_t MIN = {0, 0};
const vector_t MAX = {1000, 500};
const vector_t CENTER = {100, 100}; // a default center initialiser
const char *FONT_PATH = "assets/impact.ttf";
const size_t TEXT_SIZE = 18;
const size_t TEXT_HEIGHT_SCALE = 2;

const double BALL_RADIUS = 10;  // coins
const size_t CIRC_NPOINTS = 20;

const double_t VEL = 350;
const double_t g = 500;
const vector_t SHIP_VELOCITY = {100, 0}; 
const double SHIP_SPEED = 100;
const double SPEED_UP = 300;
const color_t coincolor = (color_t){0.5,1,0};
const color_t gamecolor = (color_t){1,0,1};
const color_t monstcolor = (color_t){0,0,1};
const color_t playercolor = (color_t){0,1,1};
const char *PLATFORM_INFO = "platform";
const char *MONSTER_INFO = "monster";
const char *PLAYER_INFO = "player";
const char *COIN_INFO = "coin";
const char *BULLET_INFO = "bullet";
const vector_t VELOCITY = (vector_t){.x=0, .y=-50};
const double_t W = 100;
const double_t H = 5;
const double_t monster_W = 40;
const double_t monster_H = 30;
const double_t player_W = 15;
const double_t player_H = 15;
const double BULLET_WIDTH = 5;
const double BULLET_LENGTH = 20;
const color_t BULLET_COLOR = (color_t){0.2, 0.1, 0.3};
const double BULLET_SPEED = 100;

/**
 * Things that still need fixing:
 * - initialise the game with some platforms so you
 * dont need to rely on double jump to move
 * - the menu creation should be more efficient;
 * make more use of the game over function
 */


typedef struct state {
  size_t points;
  double_t time;
  scene_t *scene;
  size_t round;
} state_t;

/**
 * Given a scene and an info, which serves as an identifier 
 * for a particular group, will return a list of all the
 * bodies within the scene that belongs to the group.
 * Note that the user is responsible for freeing
 * the returned list. The bodies inside the list will
 * NOT be freed.
 * 
 * @param scene a pointer to the scene
 * @param info the info associated with a group 
 * (e.g PLAYER_INFO)
 * @return the list of all body_t in the group
 */
list_t *get_group(scene_t *scene, void *info) {
  size_t num_bodies = scene_bodies(scene);
  // NULL because we don't want to free the bodies themselves
  list_t *body_list = list_init(1, NULL);
  for (size_t i = 0; i < num_bodies; i++) {
    body_t *body = scene_get_body(scene, i);
    if (strcmp(info, body_get_info(body)) == 0) {
      list_add(body_list, body);
    }
  }
  return body_list;
}

/**
 * Implements elastic collision with the horizontal
 * boundaries of the screen (left and right wall)
 * @param body the body_t 
 */
void horizontal_boundaries(body_t *body){
  vector_t pos = body_get_centroid(body);
  vector_t vel = body_get_velocity(body);
  if (((pos.x >= MAX.x) && (vel.x > 0)) || ((pos.x <= MIN.x) && (vel.x < 0))){
    body_set_velocity(body, (vector_t){-vel.x, vel.y});
  }
}


/**
 * Implements elastic collision with the upper wall.
 * @param body the body_t
 */
void upper_vertical_boundary(body_t *body){
  vector_t pos = body_get_centroid(body);
  vector_t vel = body_get_velocity(body);
  if ((pos.y >= MAX.y) && (vel.y > 0)){
    body_set_velocity(body, (vector_t){vel.x, -vel.y});
  }
}

/**
 * Implements a collision with the bottom wall
 * which results in the object rebounding to a set
 * height with a set velocity determined by VEL,
 * regardless of initial speed before collision.
 */
void rebound(body_t *body){
  vector_t pos = body_get_centroid(body);
  vector_t vel = body_get_velocity(body);
  if ((pos.y <= MIN.y) && (vel.y < 0)){
    body_set_velocity(body, (vector_t){vel.x, VEL});
  }
}

/**
 * Checks whether the body has reached the bottom of
 * the screen. If so, marks it for removal.
 */
void reached_bottom(body_t *body){
  vector_t pos = body_get_centroid(body);
  if (pos.y <= MIN.y){
    body_remove(body);
  }
}

void out_of_box(body_t *body){
  vector_t pos = body_get_centroid(body);
  if (pos.x <= MIN.x || pos.x>= MAX.x || pos.y <= MIN.y || pos.y >= MAX.y){
    body_remove(body);
  }
}

/**
 * Given a scene and a particular group within it,
 * specified by info, will implement the appropriate boundary
 * checks and updates for the particular group. If there are
 * no objects of that group in the scene, does nothing.
 * 
 * Player: will implement elastic collision with all walls
 * except for the bottom wall where a set rebound is implemented.
 * 
 * Monster: elastic collision with horizontal walls and removes
 * it if it has reached the bottom of the screen.
 * 
 * Platform: removed if at the bottom of the screen.
 * 
 * Coin: nothing 
 * 
 */
void boundary(scene_t *scene, void *info){
  list_t *group = get_group(scene, info);
  size_t num = list_size(group);
  if (!num){
    list_free(group);
    return;
  }
  if (strcmp(info, PLAYER_INFO) == 0){
      for (size_t i = 0; i < num; i++){
        body_t *body = list_get(group, i);
        horizontal_boundaries(body);
        upper_vertical_boundary(body);
        rebound(body);
      }
  }
  if (strcmp(info, MONSTER_INFO) == 0){
    for (size_t i = 0; i < num; i++){
      body_t *body = list_get(group, i);
      horizontal_boundaries(body);
      reached_bottom(body);    
    }
  }
  if (strcmp(info, PLATFORM_INFO) == 0){
    for (size_t i = 0; i < num; i++){
      body_t *body = list_get(group, i);
      reached_bottom(body);    
    }
  }
  if ((strcmp(info, COIN_INFO) == 0)){
    list_free(group);
    return;
  }
  if (strcmp(info, BULLET_INFO) == 0){
    for (size_t i = 0; i < num; i++){
      body_t *body = list_get(group, i);
      out_of_box(body);    
    }
  }
  list_free(group);
  }

/**
 *  deprecated -- use boundary instead as it is
 * much more general
 */
void wrap_group(scene_t *scene, void *info){
  list_t *group = get_group(scene, info);
  size_t num = list_size(group);
  for (size_t i = 0; i < num; i++){
    body_t *body = list_get(group, i);
    // check wrap around
    vector_t position = body_get_centroid(body);
    vector_t velocity = body_get_velocity(body);
    if ((position.x >= MAX.x) && (velocity.x > 0)) {
      //vector_t updated_pos = {.x = MIN.x + 0.1, .y = position.y};
      vector_t updated_vel = {.x=-velocity.x, .y = velocity.y};
      //body_set_centroid(body, updated_pos);
      body_set_velocity(body, updated_vel);
    }
    if ((position.x <= MIN.x) && (velocity.x < 0)) {
      //vector_t updated_pos = {.x = MAX.x - 0.1, .y = position.y};
      vector_t updated_vel = {.x=-velocity.x, .y = velocity.y};
      //body_set_centroid(body, updated_pos);
      body_set_velocity(body, updated_vel);
    }
  
    if ((position.y <= MIN.y) && (velocity.y < 0)) {
      // this is actually game over 
      //vector_t updated_pos = {.x = position.x, .y = MAX.y - 0.1};
      vector_t updated_vel = {.x=velocity.x, .y = VEL};
      //body_set_centroid(body, updated_pos);
      body_set_velocity(body, updated_vel);
    }
  
    if ((position.y >= MAX.y) && (velocity.y > 0)) {
      //vector_t updated_pos = {.x = position.x, .y = MIN.y + 0.1};
      vector_t updated_vel = {.x=velocity.x, .y = -velocity.y};
      //body_set_centroid(body, updated_pos);
      body_set_velocity(body, updated_vel);
    }
  }
}

list_t *make_arc(size_t sides, double_t radius, double_t full_angle, double_t offset_angle){
  double_t angle = full_angle / sides;
  list_t *vertices = list_init(sides, free); // this will eventually be passed to 
  // a body_t init and so will be owned and freed there
  vector_t *center = malloc(sizeof(vector_t));
  *center = (vector_t){0,0};
  list_add(vertices, center);
  for (size_t i = 0; i < sides; i++){
    vector_t *vex = malloc(sizeof(vector_t));
    double x = center->x + radius * cos((i * angle));
    double y = center->y + radius * sin((i * angle));
    *vex = (vector_t) {x, y};
    list_add(vertices, vex);
  }
  return vertices;
}

list_t *make_box(double_t w, double_t h){
  list_t *box = list_init(4, free);
  for (size_t i = 0; i < 4; i++){
    vector_t *v = malloc(sizeof(vector_t));
    list_add(box, v);
  }
  vector_t *v1 = (vector_t *)list_get(box, 0);
  *v1 = (vector_t){0,0};
  vector_t *v2 = (vector_t *)list_get(box, 1);
  *v2 = (vector_t){0,h};
  vector_t *v3 = (vector_t *)list_get(box, 2);
  *v3 = (vector_t){w,h};
  vector_t *v4 = (vector_t *)list_get(box, 3);
  *v4 = (vector_t){w,0};
  return box;
}

/**
 * Makes the platform object
 */
body_t *make_platform(size_t w, size_t h){
  list_t *platform_shape = list_init(4, NULL); // initialise a list of vectors
  vector_t *c1 = malloc(sizeof(vector_t));
  c1->x = 0;
  c1->y = 0;
  vector_t *c2 = malloc(sizeof(vector_t));
  c2->x = 0;
  c2->y = h;
  vector_t *c3 = malloc(sizeof(vector_t));
  c3->x = w;
  c3->y = h;
  vector_t *c4 = malloc(sizeof(vector_t));
  c4->x = w;
  c4->y = 0;
  list_add(platform_shape, c1);
  list_add(platform_shape, c2);
  list_add(platform_shape, c3);
  list_add(platform_shape, c4);
  body_t *platform = body_init_with_info(platform_shape, 1.0, gamecolor, (void *)PLATFORM_INFO, NULL);
  return platform;
}

/**
 * Makes the monster shape and initialises it to move side to side horizontally
 * and move down with the same speed as the platforms.
 */
body_t *make_monster(size_t w, size_t h){
  list_t *monster_shape = make_arc(20, 50, M_PI/2, M_PI/2);
  body_t *monster = body_init_with_info(monster_shape, 1.0, monstcolor, (void *)MONSTER_INFO, NULL);
  body_set_velocity(monster, (vector_t){50, VELOCITY.y});
  size_t x_pos = rand() % (size_t)MAX.x;
  size_t y_pos = MAX.y;
  body_set_centroid(monster, (vector_t){x_pos, y_pos});
  return monster;
}

/**
 * Spawns the monster onto the screen.
 */
void spawn_monster(scene_t *scene){
  body_t *monster = make_monster(monster_W, monster_H);
  scene_add_body(scene, monster);
}

/**
 * makes the player shape
 */
body_t *make_player(size_t w, size_t h){
  list_t *player_shape = list_init(4, NULL); // initialise a list of vectors
  vector_t *c1 = malloc(sizeof(vector_t));
  c1->x = 0;
  c1->y = 0;
  vector_t *c2 = malloc(sizeof(vector_t));
  c2->x = 0;
  c2->y = h;
  vector_t *c3 = malloc(sizeof(vector_t));
  c3->x = w;
  c3->y = h;
  vector_t *c4 = malloc(sizeof(vector_t));
  c4->x = w;
  c4->y = 0;
  list_add(player_shape, c1);
  list_add(player_shape, c2);
  list_add(player_shape, c3);
  list_add(player_shape, c4);
  body_t *player = body_init_with_info(player_shape, 1.0, playercolor, (void *)PLAYER_INFO, NULL);
  //body_set_centroid(player, (vector_t){.x=400, .y=50});
  //body_set_velocity(player, (vector_t){0, -200});
  return player;
}

/**
 * makes the coin shape
 */
body_t *make_coin(vector_t center, double radius, double mass,
  color_t color) {
list_t *c = list_init(CIRC_NPOINTS, free);

for (size_t i = 0; i < CIRC_NPOINTS; i++) {
double angle = 2 * M_PI * i / CIRC_NPOINTS;

vector_t *v = malloc(sizeof(*v));
assert(v);

vector_t unit = {cos(angle), sin(angle)};
*v = vec_add(vec_multiply(radius, unit), center);

list_add(c, v);
}
return body_init_with_info(c, mass, color, (void *)COIN_INFO, NULL); // changed to an enum here
}

/** Make a circle-shaped body object.
 *
 * @param center a vector representing the center of the body.
 * @param width the width of the bullet
 * @param length the length of the bullet
 * @param color the color of the bullet
 * @param info to specify whether you are making a ship bullet or an invader
 * bullet
 * @return pointer to the bullet-shaped body
 */
body_t *make_bullet(vector_t center, double width, double length, color_t color) {
vector_t offsets[] = {{-1, 1}, {1, 1}, {1, -1}, {-1, -1}};
list_t *points = list_init(4, free);

for (size_t i = 0; i < 4; i++) {
vector_t *v = malloc(sizeof(vector_t));
*v = (vector_t){center.x + offsets[i].x * width / 2,
  center.y + offsets[i].y * length / 2};
list_add(points, v);
}
return body_init_with_info(points, 1, color, (void *)BULLET_INFO, NULL);
}

/**
 * Chooses a random monster out of the remaining monster in the game to shoot
 * a bullet at the player in the direction of the player's current position.
 * Does nothing if there are no monsters or players in the game.
 *
 * @param scene a pointer to a scene object representing the current demo
 * scene
 */
void monster_shoot_bullet(scene_t *scene) {
  list_t *monster_list = get_group(scene, (void *)MONSTER_INFO);
  list_t *user = get_group(scene, (void *)PLAYER_INFO);
  if ((!list_size(monster_list)) || (!list_size(user))){
    list_free(user);
    list_free(monster_list);
    return;
  }
  body_t *player = list_get(user, 0);
  size_t num = list_size(monster_list);
  size_t index = rand() % num;
  body_t *monster = list_get(monster_list, index);
  body_t *bullet =
      make_bullet(body_get_centroid(monster), BULLET_WIDTH, BULLET_LENGTH,
                  BULLET_COLOR);
  vector_t v1 = body_get_centroid(player);
  vector_t v2 = body_get_centroid(monster);
  vector_t v3 = vec_subtract(v1, v2);
  v3 = vec_multiply(1/vec_get_length(v3), v3);
  v3 = vec_multiply(BULLET_SPEED, v3);
  body_set_velocity(bullet, v3);
  scene_add_body(scene, bullet);
  list_free(monster_list);
  list_free(user);
}


/**
 * makes the platforms generate at the top of the screen in random positions
 * @param num_bodies the number of platforms you want to generate on a given line
 */
void generate_moving_platforms(scene_t *scene, size_t num_bodies, bool initialise){
  for (size_t i = 0; i < num_bodies; i++){
    body_t *body = make_platform(W, H);
    body_set_velocity(body, VELOCITY);
    size_t y_pos;
    if (initialise){
      y_pos = rand() % (size_t) MAX.y;
    }
    else {
      y_pos = MAX.y;
    }
    size_t x_pos = rand() % (size_t)MAX.x;
    vector_t position = {.x=x_pos, .y=y_pos};
    body_set_centroid(body, position);
    scene_add_body(scene,body);
  }
}

/**
 * makes coins spawn randomly on the screen
 */
void spawn_coins(scene_t *scene, size_t num_coins){
  for (size_t i = 0; i < num_coins; i++){
    size_t x_pos = rand() % (size_t)MAX.x;
    size_t y_pos = rand() % (size_t) MAX.y;
    vector_t center = {.x=x_pos, .y=y_pos};
    body_t *coin = make_coin(center, BALL_RADIUS, 1, coincolor);
    scene_add_body(scene,coin);
  }
}

/** Registers a destructive collision force between each pair of objects
 * from distinct groups. i.e. register a destructive collision between an
 * invader's bullet and the user's ship.
 *
 * @param scene a pointer to a scene object representing the current demo
 * @param info1 a pointer to the info of a body in the scene, used as a group
 * identifier
 * @param info2 as above.
 */
void register_destructive_collision(scene_t *scene, void *info1, void *info2) {
  list_t *group1 = get_group(scene, info1);
  size_t num1 = list_size(group1);
  list_t *group2 = get_group(scene, info2);
  size_t num2 = list_size(group2);
  for (size_t i = 0; i < num1; i++) {
    for (size_t j = 0; j < num2; j++) {
      body_t *body1 = list_get(group1, i);
      body_t *body2 = list_get(group2, j);
      create_destructive_collision(scene, body1, body2);
    }
  }
  list_free(group1);
  list_free(group2);
}

void init_player(scene_t *scene){
  body_t *player = make_player(player_W, player_H);
  body_t *platform = make_platform(W, H);
  size_t x = 400;
  size_t y = 400;
  vector_t pos_pl = {y, x};
  vector_t pos_p = {y+70, x}; // why aren't they being set
  body_set_centroid(platform, pos_pl);
  body_set_velocity(platform, VELOCITY);
  body_set_centroid(player, pos_p);
  scene_add_body(scene, platform);
  scene_add_body(scene, player);
}

/**
 * implements basic controls. Left and right movement. Up arrow 
 * lets you 'jump'. No down arrow control.
 */
void on_key(char key, key_event_type_t type, double held_time, state_t *state) {
  list_t *user = get_group(state->scene, (void *)PLAYER_INFO);
  // checking if a the ship exists
  if (list_size(user) == 0) {
    return;
  }
  body_t *ship_body = list_get(user, 0); // assuming only one ship in the game
  vector_t updated_velocity = body_get_velocity(ship_body);
  if (type == KEY_PRESSED) {
    switch (key) {
    case LEFT_ARROW:
      updated_velocity = (vector_t){-SHIP_SPEED - SPEED_UP * held_time, updated_velocity.y};
      break;

    case UP_ARROW:
      updated_velocity = (vector_t){0, updated_velocity.y};
      break;

    case RIGHT_ARROW:
      updated_velocity = (vector_t){SHIP_SPEED + SPEED_UP * held_time, updated_velocity.y};
      break;

    //case DOWN_ARROW:
      //updated_velocity = (vector_t){0, -SHIP_SPEED - SPEED_UP * held_time};
      //break;

    case SPACE_BAR:
      updated_velocity = (vector_t){updated_velocity.x, VEL};
    }
  }
  body_set_velocity(ship_body, updated_velocity);
  list_free(user);
}

void restart_game(char key, key_event_type_t type, double held_time, state_t *state){
  if (type == KEY_PRESSED){
    switch(key){
      case SPACE_BAR:{ // resumes the game
        //body_t *player = make_player(player_W, player_H);
        //scene_add_body(state->scene, player);
        init_player(state->scene);
        break;
      }
      case DOWN_ARROW:{
        scene_free(state->scene);
        state->scene = scene_init();
        //body_t *player = make_player(player_W, player_H);
        //scene_add_body(state->scene, player);
        init_player(state->scene);
        state->points = 0;
        state->round++;
        break;
      }
      
    }
  }
}

/**
 * getting dimensions for text
 */
vector_t get_dimensions_for_text(const char *text) {
  return (vector_t){strlen(text) * TEXT_SIZE, TEXT_SIZE * TEXT_HEIGHT_SCALE};
}


/**
 * display of the menu -- works but not completed as there exist memory leaks
 */
void display_menu(state_t *state){
  // this will be called when the game is over and i want to create an asset
  // that renders the text
  sdl_clear(); // probably because no longer want any bodies...
  //size_t num_messages = 3;
  const char *game_over = "GAME OVER!"; // have constant messages
  const char *points = "Points: %zu";
  const char *instructions = "PRESS SPACE TO CONTINUE; PRESS DOWN TO RESTART";
  //const char *instructions = "PRESS X TO CONTINUE";
  //char *message = malloc(sizeof(char) * strlen(MESSAGE));
  //sprintf(message, MESSAGE, state->points);
  vector_t dims = get_dimensions_for_text(game_over);
  SDL_Rect *bounding_box1 = sdl_get_rect(0.3*MAX.x, 0.5*MAX.y, dims.x, dims.y); 
  asset_t *asset_game_over = asset_make_text(FONT_PATH, *bounding_box1, game_over, gamecolor);
  char buffer[strlen(points)];
  sprintf(buffer, points, state->points);
  vector_t dims2 = get_dimensions_for_text(points);
  SDL_Rect *bounding_box2 = sdl_get_rect(0.3*MAX.x, 0.5*MAX.y + 50, dims2.x, dims2.y); 
  asset_t *asset_points = asset_make_text(FONT_PATH, *bounding_box2, buffer, gamecolor);
  vector_t dims3 = get_dimensions_for_text(instructions);
  SDL_Rect *bounding_box3 = sdl_get_rect(0.3*MAX.x, 0.5*MAX.y+100, dims3.x, dims3.y); 
  asset_t *asset_instructions = asset_make_text(FONT_PATH, *bounding_box3, instructions, gamecolor);

  asset_render(asset_game_over);
  asset_render(asset_points);
  asset_render(asset_instructions);
  sdl_show();
}

/**
 * A helper function that will let you know when to 'execute' a specific
 * function if you only want to execute a function at a particular time 
 * interval rather than calling it every dt. For example,
 * if you want to spawn a monster every 5 seconds then time_const = 5.
 * Does NOT actually execute the function.
 * 
 * @param time_const the specified regular time interval that you want to 
 * exceute your function at
 * @return bool: true if it is time to execeute, false if it is not. 
 */
bool executor(double_t time, double_t dt, size_t time_const){
  if ((((size_t)time % time_const == 0) &&
      ((size_t)(time - dt) % time_const != 0)) || time == 0){
        return true;
      }
  return false;
}

/**
 * Implements the basic effect of falling due to gravity,
 * following the simple motion equations for constant acceleration
 */
void gravity_velocity(double_t dt, scene_t *scene){
  // assuming player is at position 0 and only one player object in the game
  list_t *user = get_group(scene, (void *)PLAYER_INFO);
  body_t *body = list_get(user, 0); 
  //assert(strcmp(PLAYER_INFO, body_get_info(body)) == 0);
  vector_t velocity = body_get_velocity(body);
  double y = velocity.y - g*dt;
  vector_t update_vel = {.x = velocity.x, .y=y};
  body_set_velocity(body, update_vel);
  list_free(user);
}

/**
 * checks whether the player has collided with a platform
 * and handles two cases: if the player is passing the platform
 * from above then nothing happens. If the player is passing
 * it from above, i.e. landing on the platform then
 * it will rebound off of it, like a solid surface.
 */
void collision_with_platform(scene_t *scene){
  list_t *user = get_group(scene, (void *)PLAYER_INFO);
  list_t *platforms = get_group(scene, (void *)PLATFORM_INFO);
  body_t *player = list_get(user, 0);
  size_t num = list_size(platforms);
  for (size_t i = 0; i< num; i++){
    if (find_collision(player, list_get(platforms, i))){
      // then you should just reverse the 
      vector_t vel = body_get_velocity(player);
      // but we only want to check if it's from above
      if (vel.y < 0){
        body_set_velocity(player, (vector_t){vel.x, VEL});
      }
    }
  }
  list_free(user);
  list_free(platforms);
}

/**
 * Checks whether the player has eaten a coin in the scene
 * and updates the players' points accordingly.
 */
void eat_coin(state_t *state){
  list_t *user = get_group(state->scene, (void *)PLAYER_INFO);
  list_t *coins = get_group(state->scene, (void *)COIN_INFO);
  body_t *player = list_get(user, 0);
  size_t num = list_size(coins);
  for (size_t i = 0; i< num; i++){
    body_t *coin = list_get(coins, i);
    if (find_collision(player, coin)){
      body_remove(coin);
      state->points++;
    }
  }
  list_free(user);
  list_free(coins);
}

/**
 * depecrated: use boundary() instead
 */
void platform_below_screen(scene_t *scene){
  list_t *platforms = get_group(scene, (void *)PLATFORM_INFO);
  size_t num = list_size(platforms);
  for (size_t i = 0; i < num; i++){
    body_t *platform = list_get(platforms, i);
    vector_t pos = body_get_centroid(platform);
    if (pos.y < MIN.y){
      body_remove(platform);
    }
  }
  list_free(platforms);
}

bool game_over(state_t *state) {
  list_t *user = get_group(state->scene, (void *)PLAYER_INFO);
  // check to see if the ship is still there
  if (list_size(user) == 0) {
    list_free(user);
    return true;
  }
  return false;
}




state_t *emscripten_init() {
  state_t *state = malloc(sizeof(state_t));
  assert(state);
  TTF_Init();
  sdl_init(MIN, MAX);
  asset_cache_init();
  scene_t *scene = scene_init();
  //body_t *player = make_player(player_W, player_H);
  //scene_add_body(scene, player);
  init_player(scene);
  state->scene = scene;
  state->points = 0;
  state->time = 0;
  state->round = 0;
  generate_moving_platforms(state->scene, 20, true);
  // should initialise the player on the platform...
  return state;
}

bool emscripten_main(state_t *state) {
  double_t dt = time_since_last_tick();
  state->time += dt;
  if (! game_over(state)){ 
    // doing time-dependent things like spawning
    if (executor(state->time, dt, 2)){
      generate_moving_platforms(state->scene, 3, false);
    }
    if (executor(state->time, dt, 3)){
      spawn_coins(state->scene, 3);
    }

    if (executor(state->time, dt, 5)){
      spawn_monster(state->scene);
    }
    if (executor(state->time, dt, 2)){
      monster_shoot_bullet(state->scene);
    } 
    // updating positions and objects
    sdl_on_key((key_handler_t)on_key);
    gravity_velocity(dt, state->scene);
    collision_with_platform(state->scene);
    eat_coin(state);
    boundary(state->scene, (void *)PLAYER_INFO);
    boundary(state->scene, (void *)MONSTER_INFO);
    boundary(state->scene, (void *)PLATFORM_INFO);
    register_destructive_collision(state->scene, (void *)PLAYER_INFO, (void *)MONSTER_INFO);
    register_destructive_collision(state->scene, (void *)PLAYER_INFO, (void *)BULLET_INFO);

    scene_tick(state->scene, dt);
    sdl_render_scene(state->scene);
  
  return false;}
  else{
    display_menu(state);
    sdl_on_key((key_handler_t)restart_game);
    // should call an on_key function for X
    // and should first just restart the game by calling free?
    return false;
  }
}

void emscripten_free(state_t *state) {
  scene_free(state->scene);
  free(state->scene);

  TTF_Quit();
  asset_cache_destroy();
  free(state);
}
