#include "assert.h"
#include "state.h"
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
#include "scene.h"
#include <SDL2/SDL_mixer.h>

/**
 * Citation for music in background : Chill Day by LAKEY INSPIRED 
 * https://soundcloud.com/lakeyinspired/chill-day
 * We checked to make sure the song is copright free
 */

static const char * const IMPACT_FONT = "assets/impact.ttf";
static const char *PLAYER_PATH = "assets/player.png";
static const char *PLATFORM_PATH = "assets/platform.png";
static const char *BACKGROUND_PATHS[] = { "assets/bkg.png", "assets/bkg2.png", "assets/bkg3.png"};
static const size_t NUM = 3;
static const char *MONSTER_PATH = "assets/birdmonster2.png";
static const char *COIN_PATH = "assets/coin.png";
static const char *BULLET_PATH = "assets/bullet.png";
static const char *MUSIC = "assets/song.ogg"; 
static const int FREQUENCY = 48000;
static const int CHANNEL = 2;
static const int SIZE = 2048;

static const double_t MASS = 1.0;
static const double MOVINGY = -50;
static const double_t MOVINGX = 50;
static const size_t INC = 30; 
static const double_t VEL = 300; 
static const double_t g = 500;
static const double_t Y = 250.0;
static const double_t TIMER = 10;
static const double SCREEN_ORIGIN_Y=0;
static const double SCREEN_ORIGIN_X=0;
static const vector_t MIN = {0, 0};
static const vector_t MAX = {1000, 500};
static const vector_t NORM = {0, 1};
static const size_t ROUND_0 = 1;
static const size_t SIDES = 4;



static const color_t MONSTER_COLOR = (color_t){0,0,1};
static const double_t MONSTER_W = 60;
static const double_t MONSTER_H = 100;
static const double_t MONSTER_TIME = 2.5;
static const size_t INITIAL_PLATFORM_COUNT = 30;

static const double PLATFORM_W = 100;
static const double PLATFORM_H = 20;
static const color_t PLATFORM_COLOR = (color_t){1,0,1};

static const double PLAYER_W = 30;
static const double PLAYER_H = 45;
static const color_t PLAYER_COLOR = (color_t){0,1,1};
static const vector_t INITIAL_POSITION = {0.5*MAX.x, 0.2*MAX.y};
static const double_t PLAYER_SPEED = 150;
static const double_t SPEED_UP = 200;

static const color_t COIN_COLOR = (color_t){0.5,1,0};
static const double_t COIN_TIME = 3;
static const size_t NUM_COINS = 5;
static const size_t COIN_NUM_PTS = 8;
static const double_t COIN_OFFSET = 0;
static const double_t COIN_RADIUS = 25;
static const double_t COIN_FULL_ANGLE = 2*M_PI;

static const double BULLET_W = 5;
static const double BULLET_H = 25;
static const color_t BULLET_COLOR = (color_t){0,0,0};
static const double_t BULLET_SPEED = 200;
static const vector_t BULLET_DIRECTION = {0, 1};
static const double_t BULLET_TIME = 4;
static const size_t NUM_BULLETS = 1;

typedef enum {PLAYER, MONSTER, PLATFORM, COIN, BULLET, PLAYER_BULLET} species_t;
static const char *SPECIES[] = {"player", "monster", "platform", "coin", "bullet", "player-bullet"};


static const size_t NUM_MESSAGES = 7;
text_t STATIC_MESSAGES[] = {
  {.type = REG_MESSAGE,
  .text = "MENU",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.5*MAX.y},
  .color = {1,0.3,0.8},
  .val_type = NONE,
  .is_button = false,
  .function = CONTINUE},
  {.type = FORMATTED_MESSAGE,
  .text = "POINTS: %zu",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.7*MAX.y},
  .color = {0.2,0.1,0.9},
  .val_type = POINTS,
  .is_button = false,
  .function = CONTINUE},
  {.type = FORMATTED_MESSAGE,
  .text = "ROUNDS: %zu",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.8*MAX.y},
  .color = {0.2,0.1,0.9},
  .val_type = ROUNDS,
  .is_button = false,
  .function = CONTINUE},
  {.type = REG_MESSAGE,
  .text = "CLICK HERE TO RESTART",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.9*MAX.y},
  .color = {0.2,0.1,0.9},
  .val_type = NONE,
  .is_button = true,
  .function = RESTART}, 
  {.type = REG_MESSAGE,
  .text = ":(",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.2*MAX.y},
  .color = {0.2,0.1,0.9},
  .val_type = NONE,
  .is_button = false,
  .function = CONTINUE},
  {.type = FORMATTED_MESSAGE,
  .text = "Average points per round: %zu",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.3*MAX.y},
  .color = {0.7,0.1,0.9},
  .val_type = AVG,
  .is_button = false,
  .function = CONTINUE},
  {.type = REG_MESSAGE,
  .text = "CLICK TO SEE ADVANCED STATS",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.4*MAX.y},
  .color = {0,0.5,0.9},
  .val_type = NONE,
  .is_button = true,
  .function = ADVANCED},
  {.type = REG_MESSAGE,
  .text = "CLICK HERE TO CONTINUE",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.6*MAX.y},
  .color = {0.2,0.1,0.9},
  .val_type = NONE,
  .is_button = true,
  .function = RESUME}
  };

static const size_t NUM_COMPLETE_MESSAGES = 1;
text_t COMPLETE_MESSAGE[] = {{.type = REG_MESSAGE,
  .text = "CLICK HERE TO CONTINUE TO NEXT ROUND",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.6*MAX.y},
  .color = {0.2,0.1,0.9},
  .val_type = NONE,
  .is_button = true,
  .function = RESUME}};

static const size_t NUM_INSTRUCTIONS = 6;
text_t INSTRUCTIONS_MESSAGE[] = {
  {.type = REG_MESSAGE,
  .text = "CLICK HERE TO START GAME",
  .font_path =IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.7*MAX.y},
  .color = {0,0.0,0.0},
  .val_type = NONE,
  .is_button = true,
  .function = UNPAUSE},
  {.type = REG_MESSAGE,
  .text = "INSTRUCTIONS:",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.2*MAX.y},
  .color = {0.1,0.1,0.1},
  .val_type = NONE,
  .is_button = false,
  .function = CONTINUE},
  {.type = REG_MESSAGE,
  .text = "LEFT RIGHT UP KEYS TO MOVE",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.3*MAX.y},
  .color = {0.9,0.0,0.9},
  .val_type = NONE,
  .is_button = false,
  .function = CONTINUE},
  {.type = REG_MESSAGE,
  .text = "SPACE TO JUMP / DOWN TO SHOOT",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.4*MAX.y},
  .color = {0.0,0.1,0.9},
  .val_type = NONE,
  .is_button = false,
  .function = CONTINUE},
  {.type = REG_MESSAGE,
  .text = "PRES P TO PAUSE GAME",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.5*MAX.y},
  .color = {0.8, 0.5, 0.0},
  .val_type = NONE,
  .is_button = false,
  .function = CONTINUE},
  {.type = REG_MESSAGE,
  .text = "ANY KEY TO PLAY MUSIC",
  .font_path = IMPACT_FONT,
  .location = (vector_t){0.3*MAX.x, 0.6*MAX.y},
  .color = {1.0, 0.0, 0.0},
  .val_type = NONE,
  .is_button = false,
  .function = CONTINUE}};

static const size_t NUM_PAUSED_MESSAGES = 1;
text_t PAUSED_MESSAGE[] = {{.type = REG_MESSAGE,
    .text = "CLICK ON THIS LINE TO UNPAUSE",
    .font_path = IMPACT_FONT,
    .location = (vector_t){0.3*MAX.x, 0.6*MAX.y},
    .color = {0.2,0.1,0.9},
    .val_type = NONE,
    .is_button = true,
    .function = UNPAUSE}};

static const size_t NUM_INGAME_MESSAGES = 2;
text_t INGAME_MESSAGES[] = {
  {.type = FORMATTED_MESSAGE,
    .text = "POINTS: %zu",
    .font_path = IMPACT_FONT,
    .location = (vector_t){0.1*MAX.x, 0.1*MAX.y},
    .color = {0,0,0},
    .val_type = POINTS,
    .is_button = false,
    .function = CONTINUE},
  {.type = FORMATTED_MESSAGE,
      .text = "COUNTDOWN: %zu",
      .font_path = IMPACT_FONT,
      .location = (vector_t){0.1*MAX.x, 0.2*MAX.y},
      .color = {0,0,0},
      .val_type = TIME,
      .is_button = false,
      .function = CONTINUE}
};

static const size_t NUM_STATS_MESSAGES = 3;
text_t STATS_MESSAGES[] = {
  {.type = FORMATTED_MESSAGE,
    .text = "POINTS: %zu",
    .font_path = IMPACT_FONT,
    .location = (vector_t){0.1*MAX.x, 0.1*MAX.y},
    .color = {0,0,0},
    .val_type = POINTS,
    .is_button = false,
    .function = CONTINUE},
  {.type = REG_MESSAGE,
    .text = "Click back to menu",
    .font_path = IMPACT_FONT,
    .location = (vector_t){0.1*MAX.x, 0.2*MAX.y},
    .color = {0,0,0},
    .val_type = NONE,
    .is_button = true,
    .function = RETURN},
  {.type = FORMATTED_MESSAGE,
    .text = "Average points per round: %zu",
    .font_path = IMPACT_FONT,
    .location = (vector_t){0.1*MAX.x, 0.3*MAX.y},
    .color = {0.7,0.1,0.9},
    .val_type = AVG,
    .is_button = false,
    .function = CONTINUE}
};




/**
 * Given a scene and an info, which serves as an identifier 
 * for a particular group, will return a list of all the
 * bodies within the scene that belong to the group.
 * Note that the user is responsible for freeing
 * the returned list. The bodies inside the list will
 * NOT be freed.
 * 
 * @param scene a pointer to the scene
 * @param info the info associated with a group 
 * (e.g PLAYER_INFO)
 * @return the list of all body_t in the group
 */
static list_t *get_group(scene_t *scene, void *info) {
  size_t num_bodies = scene_bodies(scene);
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
 * Checks whether the player has collided with a platform
 * and handles two cases: if the player is passing the platform
 * from above then nothing happens. If the player is passing
 * it from below, i.e. landing on the platform, then
 * it will rebound off of it, like a solid surface.
 * 
 * @param scene pointer to a scene_t
 */
static void collision_with_platform(scene_t *scene){
  list_t *user = get_group(scene, (void *)SPECIES[PLAYER]);
  list_t *platforms = get_group(scene, (void *)SPECIES[PLATFORM]);
  body_t *player = list_get(user, 0);
  size_t num = list_size(platforms);

  for (size_t i = 0; i < num; i++) {
    body_t *platform = list_get(platforms, i);
    collision_info_t col = find_collision(player, platform);
    if (col.collided) {
        vector_t vel = body_get_velocity(player);
        if (vel.y < 0) {
            body_set_velocity(player, (vector_t){vel.x, VEL});
        }
    }
}
  list_free(user);
  list_free(platforms);
}

/**
 * We fix the player on the screen at a constant height and move all other objects 
 * down if we go above the height so it looks like the screen is moving 
 * down.
 * @param scene
 * @param Y - the position we fix to keep player at
 */
static void track_camera(scene_t *scene, double_t Y) {
  list_t *user = get_group(scene, (void *)SPECIES[PLAYER]);
  body_t *player = list_get(user, 0);
  vector_t c = body_get_centroid(player);

  if (c.y > Y) {
      double_t diff = c.y - Y;
      size_t total = scene_bodies(scene);
      for (size_t i = 0; i < total; i++) {
          body_t *b = scene_get_body(scene, i);
          vector_t pos = body_get_centroid(b);
          pos.y -= diff;
          body_set_centroid(b, pos);
      }
  }
  list_free(user);
}

/**
 * Implements elastic collision with the horizontal
 * boundaries of the screen (left and right wall)
 * @param body the body_t 
 */
static void horizontal_boundaries(body_t *body){
  vector_t pos = body_get_centroid(body);
  vector_t vel = body_get_velocity(body);
  if (((pos.x > MAX.x) && (vel.x > 0)) || ((pos.x < MIN.x) && (vel.x < 0))){
    body_set_velocity(body, (vector_t){-vel.x, vel.y});
  }
}

/**
 * Implements elastic collision with the upper wall.
 * @param body the body_t
 */
static void upper_vertical_boundary(body_t *body){
  vector_t pos = body_get_centroid(body);
  vector_t vel = body_get_velocity(body);
  if ((pos.y > MAX.y) && (vel.y > 0)){
    body_set_velocity(body, (vector_t){vel.x, -vel.y});
  }
}


/**
 * Checks whether the body has reached the bottom of
 * the screen. If so, marks it for removal.
 * @param body
 */
static void reached_bottom(body_t *body){
  vector_t pos = body_get_centroid(body);
  if (pos.y < MIN.y){
    body_remove(body);
  }
}

/**
 * Checks whether a body has reached outside the box of the screen
 * so that it can be freed as it is no longer needed to keep track
 * of.
 * @param body
 */
static void out_of_box(body_t *body){
  vector_t pos = body_get_centroid(body);
  if (pos.x < MIN.x || pos.x> MAX.x || pos.y < MIN.y || pos.y > MAX.y){
    body_remove(body);
  }
}

/**
 * Checks whether the player has eaten a coin in the scene
 * and updates the players' points accordingly.
 * 
 * @param state
 */
static void eat_coin(state_t *state){
  list_t *user = get_group(state->scene, (void *)SPECIES[PLAYER]);
  list_t *coins = get_group(state->scene, (void *)SPECIES[COIN]);
  body_t *player = list_get(user, 0);
  size_t num = list_size(coins);
  for (size_t i = 0; i< num; i++){
    body_t *coin = list_get(coins, i);
    if (find_collision(player, coin).collided){
      body_remove(coin);
      state->points++;
    }
  }
  list_free(user);
  list_free(coins);
}


/** Registers a destructive collision force between a single
 * object and every member of a single group. 
 * i.e. register a destructive collision between a single player's
 * bullet and all the monsters present within the scene.
 *
 * @param scene a pointer to a scene object representing the current demo
 * @param body a pointer to the body which should be registered with a collision
 * @param info a pointer to the info of a body in the scene, used as a group
 * identifier
 */
static void register_destructive_collision(scene_t *scene, body_t *body, void *info) {
  list_t *group = get_group(scene, info);
  size_t num1 = list_size(group);
  for (size_t i = 0; i < num1; i++) {
      body_t *body1 = list_get(group, i);
      create_destructive_collision(scene, body1, body);
  }
  list_free(group);
}

/**
 * Generates an arc spanning a specified angle, in a specified direction given
 * by the offset_angle, with a central point/ tip.
 * 
 * @param num_pts number of vertices
 * @param radius the radius of the arc
 * @param full_angle the angle swept by the arc
 * @param offset the offset angle (avoids having to rotate shape later)
 * @return the list_t containing pointers to the vertices of vector_t type
 */
static list_t * make_arc(size_t num_pts, double radius,double full_angle, double offset){
    double_t angle = full_angle / num_pts;
    list_t * vertices = list_init(num_pts, free); 
    vector_t * center = malloc(sizeof(vector_t));
    * center = (vector_t){0,0};
    list_add(vertices, center);
    for (size_t i = 0; i < num_pts; i++){
      vector_t * vex = malloc(sizeof(vector_t));
      double x = center->x + radius * cos((i * angle) + offset);
      double y = center->y + radius * sin((i * angle) + offset);
      * vex = (vector_t) {x, y};
      list_add(vertices, vex);
    }
    return vertices;
  }

/**
 * Generates a list_t of vertices forming a box shape.
 * @param w width
 * @param h height
 * @return list_t of vertices
 */
static list_t *make_box(double_t w, double_t h){
  list_t *box = list_init(SIDES, free);
  for (size_t i = 0; i < SIDES; i++){
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
 * Initialises a monster at the top of the screen within the scene
 * at a random x location.
 * 
 * @param scene a pointer to a scene_t
 */
static void init_monster(state_t *state){
    scene_t *scene = state->scene;
    list_t *monster_shape = make_box(MONSTER_W, MONSTER_H);
    body_t *monster = body_init_with_info(monster_shape, MASS,
                      MONSTER_COLOR, (void *)SPECIES[MONSTER], NULL);
    body_set_velocity(monster,state->monster_v);
    size_t x = rand() % (size_t)MAX.x;
    double y = MAX.y;
    vector_t position = {x, y};
    body_set_centroid(monster, position);
    scene_add_body(scene, monster);
    asset_make_image_with_body(MONSTER_PATH, monster);
    register_destructive_collision(scene, monster, (void *)SPECIES[PLAYER]);
}

/**
 * Initialises and adds a moving platform into the scene. 
 * 
 * @param scene a scene_t pointer 
 * @param num how many platforms you want to create
 * @param initialise a boolean of whether you want to initialise
 * the platforms on the screen or generate them from above
 */
static void init_platform(state_t *state, size_t num, bool initialise){
  scene_t *scene = state->scene;
  for (size_t i = 0; i < num; i++){
    list_t *platform_shape = make_box(PLATFORM_W, PLATFORM_H);
    size_t x = rand() % (size_t) MAX.x;
    size_t y;

    if (initialise){
      y = rand () % (size_t) MAX.y;
    }
    else {
      y = MAX.y + (rand() % (size_t) MAX.y);
    }
      vector_t position = {x,y};
      body_t *platform = body_init_with_info(platform_shape, MASS, PLATFORM_COLOR,(void *)SPECIES[PLATFORM], NULL);
      body_set_centroid(platform, position);
      body_set_velocity(platform, state->moving);
      scene_add_body(scene, platform);
      asset_make_image_with_body(PLATFORM_PATH, platform);
  }
}

/**
 * Positions a newly‐created bullet, gives it a velocity, and
 * registers the proper destructive collision.
 *
 * @param scene       The scene to which the bullet belongs.
 * @param bullet      The body_t pointer for the bullet.
 * @param position    Where to place the bullet (its centroid).
 * @param velocity    The bullet’s velocity (already scaled by BULLET_SPEED).
 * @param collide_key Which SPECIES[] string this bullet should collide with.
 */
static void setup_and_fire_bullet(scene_t *scene, body_t *bullet,
                                  vector_t position, vector_t velocity,
                                  const char *collide_key) {
    body_set_centroid(bullet, position);
    body_set_velocity(bullet, velocity);
    register_destructive_collision(scene, bullet, (void *)collide_key);
}

/**
 * Initialises a player on the screen at a set position with a platform just below. 
 * The player is initialised in freefall. Also initialises the asset for the image
 * of the player and platform to be attached to the body.
 * The platform is moving at the specified downward speed.
 * @param scene
 */

static void init_player(state_t* state){
  scene_t *scene = state->scene;
  list_t *player_shape = make_box(PLAYER_W, PLAYER_H);
  body_t *player = body_init_with_info(
    player_shape, MASS, PLAYER_COLOR,(void *)SPECIES[PLAYER], NULL
  );

  list_t *platform_shape = make_box(PLATFORM_W, PLATFORM_H);

  body_t *platform = body_init_with_info(
    platform_shape, MASS, PLATFORM_COLOR,(void *)SPECIES[PLATFORM], NULL
  );

  body_set_centroid(platform, INITIAL_POSITION);
  body_set_centroid(player, INITIAL_POSITION);
  body_set_velocity(platform, state->moving);

  scene_add_body(scene, platform);
  scene_add_body(scene, player);

  asset_make_image_with_body(PLATFORM_PATH, platform);
  asset_make_image_with_body(PLAYER_PATH, player);

  register_destructive_collision(scene, player, (void *)SPECIES[MONSTER]);
  register_destructive_collision(scene, player, (void *)SPECIES[BULLET]);
}

/**
 * Initialises a coin at a random position on the screen.
 * @param scene
 * @param num number of coins you want to initialise at one time
 */
static void init_coin(state_t* state, size_t num) {
    scene_t *scene = state->scene;
    for (size_t i = 0; i < num; i++) {
        list_t *coin_shape = make_arc(COIN_NUM_PTS, COIN_RADIUS, COIN_FULL_ANGLE, COIN_OFFSET);
        body_t *coin = body_init_with_info(
        coin_shape, MASS, COIN_COLOR,(void *)SPECIES[COIN], NULL
        );

        size_t x = rand() % (size_t)MAX.x;
        size_t y = rand() % (size_t)MAX.y;
        vector_t position = {x, y};

        body_set_centroid(coin, position);
        body_set_velocity(coin, state->moving);
        scene_add_body(scene, coin);
        asset_make_image_with_body(COIN_PATH, coin);
    }
}

/**
 * Initialises a bullet body_t and corresponding 
 * attached image asset. Added to the scene.
 * 
 * @param scene
 * @param info
 * @return the body_t corresponding to the bullet
 */
static body_t *make_bullet(state_t* state, void *info){
  scene_t *scene = state->scene;
  list_t *bullet_shape = make_box(BULLET_W, BULLET_H);
  body_t *bullet = body_init_with_info(
  bullet_shape, MASS, BULLET_COLOR, info, NULL
  );

  scene_add_body(scene, bullet);
  asset_make_image_with_body(BULLET_PATH, bullet);

  return bullet;
}

/**
 * Choses a random monster on the screen, and spwans a bullet
 * originating from the monster and headed in the direction
 * of the player at that instant.
 * @param scene
 * @param num number of bullets to be spawned at a given instant
 */
static void monster_shoot_bullet(state_t* state, size_t num){
  scene_t *scene = state->scene;
  list_t *monsters = get_group(scene, (void *)SPECIES[MONSTER]);
  list_t *player_list = get_group(scene, (void *)SPECIES[PLAYER]);

  body_t *player = list_get(player_list, 0);
  size_t len = list_size(monsters);

  if (!len){
    list_free(monsters);
    list_free(player_list);
    return;
  }

  for (size_t i = 0; i < num; i++){
    body_t *bullet = make_bullet(state, (void *)SPECIES[BULLET]);
    size_t rand_idx = rand() % len;
    body_t *monster = list_get(monsters, rand_idx);

    vector_t monster_pos = body_get_centroid(monster);
    vector_t player_pos = body_get_centroid(player);

    vector_t bullet_direction = vec_subtract(player_pos, monster_pos);
    bullet_direction = vec_multiply(
    1/vec_get_length(bullet_direction), bullet_direction
    );
    double_t dot = vec_dot(bullet_direction, NORM);
    double_t angle = acos(dot);

    body_set_rotation(bullet, angle);
    vector_t velocity = vec_multiply(BULLET_SPEED, bullet_direction);
    setup_and_fire_bullet(
    scene,bullet,monster_pos,velocity,(void *)SPECIES[PLAYER]
    );
  }
  
  list_free(monsters);
  list_free(player_list);
}

/**
 * Spwans an upwards travelling bullet from the player's current position.
 * @param scene
 */
static void player_shoot_bullet(state_t* state){
  scene_t *scene = state->scene;
  list_t *player_list = get_group(scene, (void *)SPECIES[PLAYER]);
  body_t *player = list_get(player_list, 0);

  vector_t position = body_get_centroid(player);
  body_t *bullet = make_bullet(state, (void *)SPECIES[PLAYER_BULLET]);
  vector_t vel = vec_multiply(BULLET_SPEED, BULLET_DIRECTION);

  setup_and_fire_bullet(
  scene, bullet, position, vel, SPECIES[MONSTER]
  );
}


/**
 * The key_handler_t used within the main loop of the game. 
 * The keys correspond to various controls of the player. If
 * the player is not in the game, then no command is executed.
 * 
 * Left arrow: goes left, accelerating as the key is held for longer.
 * 
 * Right arrow: goes right, accelerating as the key is held longer.
 * 
 * Up arrow: removes any horizontal travelling motion. 
 * 
 * Down arrow: shoot bullets
 * 
 * Space: jump.
 * 
 * @param key
 * @param type
 * @param held_time
 * @param state
 */
static void on_key(char key, key_event_type_t type, double held_time, state_t *state) {
    list_t *user = get_group(state->scene, (void *)SPECIES[PLAYER]);
    if (list_size(user) == 0) {
        return;
    }
    body_t *ship_body = list_get(user, 0);
    vector_t updated_velocity = body_get_velocity(ship_body);

    if (type == KEY_PRESSED) {
        char u = (char)toupper((unsigned char)key);
        if (u == 'P') {
            if (state->end == ALIVE) {
                state->end = PAUSE;
            }
            else if (state->end == PAUSE) {
                state->end = ALIVE;
            }
        }

        switch (key) {
            case LEFT_ARROW:
                updated_velocity = (vector_t){
                    -PLAYER_SPEED - SPEED_UP * held_time,
                    updated_velocity.y
                };
                break;

            case UP_ARROW:
                updated_velocity = (vector_t){
                    0,
                    updated_velocity.y
                };
                break;

            case RIGHT_ARROW:
                updated_velocity = (vector_t){
                    PLAYER_SPEED + SPEED_UP * held_time,
                    updated_velocity.y
                };
                break;

            case DOWN_ARROW:
                player_shoot_bullet(state);
                break;

            case SPACE_BAR:
                updated_velocity = (vector_t){
                    updated_velocity.x,
                    VEL
                };
                break;
        }
    }

    body_set_velocity(ship_body, updated_velocity);
    list_free(user);
}

/**
 * Resets and initializes the core game state and scene.
 *
 * @param state  Pointer to the state_t to be (re)initialized.
 */
static void init_game_core(state_t *state){
  state->screen = INSTRUCTIONS;
  state->end = PAUSE;
  state->time = 0;

  asset_reset_asset_list();
  scene_free(state->scene);
  state->scene = scene_init();

  size_t i = rand()%NUM;
  SDL_Rect *box = sdl_get_rect(SCREEN_ORIGIN_X, SCREEN_ORIGIN_Y, MAX.x, MAX.y);
  asset_make_image(BACKGROUND_PATHS[i], *box);

  init_platform(state, INITIAL_PLATFORM_COUNT, true);
  init_platform(state, INITIAL_PLATFORM_COUNT, false);
  init_player(state);
}

/**
 * Function called by the key_handler_t button that 
 * handles the different end-of-game options.
 * Resume game: re-intialises the player on the screen/ the scene.
 * number of rounds is incremented by 1. The moving of the
 * platforms and monsters is sped up accordingly to increase difficulty
 * of the next round. 
 * 
 * @param state
 * @param function the enum that corresponds to the desired 
 * functionality of a text asset/ button -- i.e. tells 
 * the function whether it should restart or continue the game
 */
static void restart_game(state_t *state, func_type_t function) {
    switch (function) {
        case UNPAUSE:
            state->end = ALIVE;
            return;

        case RESUME: {
            state->round++;
            state->moving = (vector_t){0, MOVINGY - state->round * INC};
            state->monster_v = (vector_t){
                MOVINGX - state->round * INC,
                MOVINGY - state->round * INC
            };
            break;
        }

        case RESTART: {
            sdl_clear();
            state->round = ROUND_0;
            state->points = 0;
            state->avg_pts = 0;
            state->moving = (vector_t){0, MOVINGY};
            state->monster_v = (vector_t){MOVINGX, MOVINGY};
            break;
        }

        default:
            return;
    }

    init_game_core(state);
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
static bool executor(double_t time, double_t dt, double_t time_const){
  if ((floor(time / time_const) >
      floor((time - dt) / time_const)) || time == 0){
        return true;
      }
  return false;
}

/**
 * We decrease the velocity of the player at a constant rate
 * to simulate gravity. So the player moves down.
 * @param dt
 * @param scene
 */
static void gravity(double_t dt, scene_t *scene) {
  list_t *players = get_group(scene, (void *)SPECIES[PLAYER]);
  body_t *player = list_get(players, 0);

  vector_t vel = body_get_velocity(player);
  vel.y -= g * dt;
  body_set_velocity(player, vel);

  list_free(players);
}


/**
 * Checks whether the game is over by checking
 * whether the player still exists within the game
 * (as opposed to having been destroyed in a destructive
 * collision with a monster or bullet).
 * @param state
 */
static bool game_over(state_t *state) {
  list_t *user = get_group(state->scene, (void *)SPECIES[PLAYER]);
  if (list_size(user) == 0) {
    state->end = DEAD;
    list_free(user);
    return true;
  }

  if (!(size_t) (state->timer - state->time)){
    list_free(user);
    state->end = COMPLETE;
    return true;
  }

  if (state->end == PAUSE){
    return true;
  }
  return false;
}


/**
 * Converts the information about each text in the list of text_t
 * into a message list stoed within the asset.c functionality.
 * This function is called once.
 * @param messages a pointer to a list of text_t which store all the
 * important information about a given line of text
 * @param num_messages the total number of texts stored in the messages list
 */
static void init_messages(text_t *messages, size_t num_messages){
  for (size_t i = 0; i < num_messages; i++){
    text_t tex = messages[i];
    asset_init_message(tex);
  }
}

/**
 * Renders the background and all queued text messages in the asset lists.
 *
 * @param state  Current game state, used by asset_message_to_asset().
 */
static void common_render(state_t *state) {
    asset_switch_list();
    asset_reset_asset_list();

    SDL_Rect *bbox = sdl_get_rect(SCREEN_ORIGIN_X, SCREEN_ORIGIN_Y, MAX.x, MAX.y);
    asset_make_image(BACKGROUND_PATHS[0], *bbox);
    asset_message_to_asset(state);

    size_t num = list_size(asset_get_asset_list());
    for (size_t i = 0; i < num; i++) {
        asset_render(list_get(asset_get_asset_list(), i));
    }

    asset_reset_asset_list();
    asset_switch_list();
}

/**
 * Renders and displays the lines of text on the menu screen.
 * Calculates the average points which is one of the displayed metrics.
 * @param state
 */
static void display_menu(state_t *state) {
    asset_reset_message_list();
    init_messages(STATIC_MESSAGES, NUM_MESSAGES);

    if (state->end == COMPLETE) {
        init_messages(COMPLETE_MESSAGE, NUM_COMPLETE_MESSAGES);
    } else if (state->end == PAUSE) {
        init_messages(PAUSED_MESSAGE, NUM_PAUSED_MESSAGES);
    }

    state->screen = MENU;
    state->avg_pts = state->points / state->round;


    common_render(state);
}

/**
 * Prepares and displays the statistics screen:
 * - Clears and enqueues stats messages
 * - Calls common_render() to draw background and messages
 *
 * @param state  Current game state, used by asset_message_to_asset().
 */
static void display_stats(state_t *state) {
    asset_reset_message_list();
    init_messages(STATS_MESSAGES, NUM_STATS_MESSAGES);
    common_render(state);
}

/**
 * Prepares and displays the instructions screen:
 * - Clears and enqueues instruction messages
 * - Calls common_render() to draw background and messages
 *
 * @param state  Current game state, used by asset_message_to_asset().
 */
static void display_instructions(state_t *state) {
    asset_reset_message_list();
    init_messages(INSTRUCTIONS_MESSAGE, NUM_INSTRUCTIONS);
    common_render(state);
}
/**
 * the key_handler_t for the controls of the menu options which are clickable
 * texts. Checks if the user has clicked on a given button. Calls restart_game()
 * to execute the expected function for the button (i.e. whether to 
 * continue/ resume or restart the game).
 * 
 * @param key
 * @param type
 * @param held_time
 * @param aux the auxiliary variable passed from the sdl_wrapper.c function
 * that handles key board/ mouse input, expected to be in the structure of
 * a list_t * where it contains the state variable at index 0 and the 
 * location of where the mouseclick occurred at index 1.
 */
static void button(char key, key_event_type_t type, double held_time, list_t *aux) {
    state_t *state    = list_get(aux, 0);
    vector_t *location = list_get(aux, 1);

    list_t *messages = asset_get_message_list();
    size_t num       = list_size(messages);

    if (type == BUTTON) {
        for (size_t i = 0; i < num; i++) {
            message_t *message = list_get(messages, i);

            if (message->is_button) {
                vector_t dims = get_dimensions_for_text(message->text);

                if (location->x >= message->location.x &&
                    location->x <= message->location.x + dims.x &&
                    location->y >= message->location.y &&
                    location->y <= message->location.y + dims.y) {

                    if (message->function == RESTART ||
                        message->function == RESUME ||
                        message->function == UNPAUSE) {

                        restart_game(state, message->function);

                    } else if (message->function == ADVANCED) {
                        state->screen = STATS;

                    } else if (message->function == RETURN) {
                        state->screen = MENU;
                    }
                }
            }
        }
    }

    free(location);
}

/**
 * Applies a given function to every body in the scene that matches `info_key`.
 *
 * @param scene     The current scene.
 * @param info_key  The SPECIES[] string that identifies the group.
 * @param fn        A callback that will be called on each body in that group.
 *                  (e.g., horizontal_boundaries, reached_bottom, etc.)
 */
static void for_each_in_group(scene_t *scene, const char *info_key,
                              void (*fn)(body_t *)) {
    list_t *group = get_group(scene, (void *)info_key);
    size_t num    = list_size(group);
    for (size_t i = 0; i < num; i++) {
        body_t *b = list_get(group, i);
        fn(b);
    }
    list_free(group);
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
 * Platform: removed if reached the bottom of the screen.
 * 
 * Coin: removed if reached the bottom of the screen.
 * 
 * Bullet and player bullet: removed if reached bottom of screen
 *  
 * @param scene
 * @param info 
 */
static void boundary(state_t *state) {
    scene_t *scene = state->scene;

    list_t *players   = get_group(scene, (void *)SPECIES[PLAYER]);
    size_t  n_players = list_size(players);
    if (n_players > 0) {
        collision_with_platform(scene);
        for (size_t i = 0; i < n_players; i++) {
            body_t *b = list_get(players, i);
            horizontal_boundaries(b);
            upper_vertical_boundary(b);
            reached_bottom(b);
        }
    }
    list_free(players);

    for_each_in_group(scene, SPECIES[MONSTER], horizontal_boundaries);
    for_each_in_group(scene, SPECIES[MONSTER], reached_bottom);

    list_t *platforms    = get_group(scene, (void *)SPECIES[PLATFORM]);
    size_t  n_platforms  = list_size(platforms);
    for (size_t i = 0; i < n_platforms; i++) {
        body_t *b = list_get(platforms, i);
        reached_bottom(b);
        if (body_is_removed(b)) {
            init_platform(state, 1, false);
        }
    }
    list_free(platforms);

    for_each_in_group(scene, SPECIES[COIN], reached_bottom);

    for_each_in_group(scene, SPECIES[BULLET], out_of_box);
    for_each_in_group(scene, SPECIES[PLAYER_BULLET], out_of_box);
}

/**
 * Executes time‐based events (coin spawn, monster spawn, and monster firing) 
 * at their respective intervals.
 *
 * @param state  Pointer to the current game state (holds time and scene).
 * @param dt     Time delta since the last tick (in seconds).
 */
static void executing_fn(state_t *state, double_t dt){
  if (executor(state->time, dt, COIN_TIME)){
    init_coin(state, NUM_COINS);
  }
  if (executor(state->time, dt, MONSTER_TIME)){
    init_monster(state);
  }
  if (executor(state->time, dt, BULLET_TIME)){
    monster_shoot_bullet(state, NUM_BULLETS);
  }
}

/**
 * Chooses and displays the appropriate screen (instructions, menu/game, or stats)
 * based on the current value of state->screen.
 *
 * @param state  Pointer to the current game state (holds screen enum).
 */
static void route_screen(state_t *state) {
    if (state->screen == INSTRUCTIONS) {
        display_instructions(state);
    } else if (state->screen == MENU || state->screen == GAME) {
        display_menu(state);
    } else if (state->screen == STATS) {
        display_stats(state);
    }
}


/**
 * Renders all current body assets and message assets, then displays the updated frame.
 *
 * @param state  Pointer to the current game state, used when converting messages to assets.
 */

static void message_handler(state_t *state){
  list_t *body_assets = asset_get_asset_list();

  for (size_t i = 0; i < list_size(body_assets); i++){
  asset_render(list_get(body_assets, i));
  }

  asset_switch_list();
  asset_switch_message_list();
  asset_message_to_asset(state); 

  size_t num = list_size(asset_get_asset_list());
  for (size_t i = 0; i < num; i++){
    asset_render(list_get(asset_get_asset_list(), i));
  }

  asset_reset_asset_list();
  asset_switch_list();
  asset_switch_message_list();
  sdl_show();
}
/**
 * Dispatches SDL input to the appropriate handler.
 * BUTTON events go to button(); key events go to on_key().
 *
 * @param key        Key code or MOUSE for clicks
 * @param type       Event type (KEY_PRESSED, KEY_RELEASED, BUTTON)
 * @param held_time  Time the key/button has been held
 * @param aux        list_t* for BUTTON, state_t* for key events
 */
static void global_input_handler(char key,key_event_type_t type,double held_time, void*aux) {
  if (type == BUTTON) {
    button(key, type, held_time, (list_t *)aux);
  } else {
    on_key(key, type, held_time, (state_t *)aux);
  }
}

state_t *emscripten_init() {
    TTF_Init();
    asset_cache_init();
    sdl_init(MIN, MAX);
    srand(time(NULL));

    Mix_OpenAudio(FREQUENCY, AUDIO_F32SYS, CHANNEL, SIZE);
    Mix_PlayMusic(Mix_LoadMUS(MUSIC), -1);

    state_t *state = malloc(sizeof(state_t));
    state->scene = scene_init();
    state->moving = (vector_t){0, MOVINGY};
    state->monster_v = (vector_t){MOVINGX, MOVINGY};
    state->round = ROUND_0;
    state->points = 0;
    state->timer = TIMER;
    state->avg_pts = 0;

    init_game_core(state);
    init_messages(INGAME_MESSAGES, NUM_INGAME_MESSAGES);
    asset_switch_message_list();
    sdl_on_key(global_input_handler);
    return state;
}


bool emscripten_main(state_t *state){
  double_t dt = time_since_last_tick();
  if (!game_over(state)){
    state->time += dt;
    if (state->screen != GAME){
      state->screen = GAME;
    }
    message_handler(state);
    executing_fn(state, dt);
    gravity(dt, state->scene);
    track_camera(state->scene, Y);
    eat_coin(state);
    boundary(state);
    scene_tick(state->scene, dt);
    sdl_clear();
    return false;
  }
  route_screen(state);
  return false;
}


void emscripten_free(state_t *state) {
  asset_list_destroy();
  asset_message_list_destroy();
  scene_free(state->scene);
  free(state->scene);
  asset_cache_destroy();
  TTF_Quit();
  Mix_CloseAudio();
  free(state);
}
