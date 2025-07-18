#include "sdl_wrapper.h"
#include <SDL2/SDL.h>
#include <SDL2/SDL2_gfxPrimitives.h>
#include <SDL2/SDL_image.h>
#include <SDL2/SDL_ttf.h>
#include <assert.h>
#include <math.h>
#include <stdlib.h>
#include <time.h>
#include <state.h>

const char WINDOW_TITLE[] = "CS 3";
const size_t WINDOW_WIDTH = 1000;
const size_t WINDOW_HEIGHT = 500;
const SDL_Color SDL_BLACK = {0, 0, 0};
const double MS_PER_S = 1000.0;
typedef struct state state_t;

/**
 * The coordinate at the center of the screen.
 */
vector_t center;
/**
 * The coordinate difference from the center to the top right corner.
 */
vector_t max_diff;
/**
 * The SDL window where the scene is rendered.
 */
SDL_Window *window;
/**
 * The renderer used to draw the scene.
 */
SDL_Renderer *renderer;
/**
 * The keypress handler, or NULL if none has been configured.
 */
key_handler_t key_handler = NULL;

/**
 * SDL's timestamp when a key was last pressed or released.
 * Used to mesasure how long a key has been held.
 */
uint32_t key_start_timestamp;
/**
 * The value of clock() when time_since_last_tick() was last called.
 * Initially 0.
 */
clock_t last_clock = 0;

/** Computes the center of the window in pixel coordinates */
vector_t get_window_center(void) {
  int *width = malloc(sizeof(*width)), *height = malloc(sizeof(*height));
  assert(width);
  assert(height);
  SDL_GetWindowSize(window, width, height);
  vector_t dimensions = {.x = *width, .y = *height};
  free(width);
  free(height);
  return vec_multiply(0.5, dimensions);
}

/**
 * Computes the scaling factor between scene coordinates and pixel coordinates.
 * The scene is scaled by the same factor in the x and y dimensions,
 * chosen to maximize the size of the scene while keeping it in the window.
 */
double get_scene_scale(vector_t window_center) {
  double x_scale = window_center.x / max_diff.x,
         y_scale = window_center.y / max_diff.y;
  return x_scale < y_scale ? x_scale : y_scale;
}

/** Maps a scene coordinate to a window coordinate */
vector_t get_window_position(vector_t scene_pos, vector_t window_center) {

  vector_t scene_center_offset = vec_subtract(scene_pos, center);
  double scale = get_scene_scale(window_center);
  vector_t pixel_center_offset = vec_multiply(scale, scene_center_offset);
  vector_t pixel = {.x = round(window_center.x + pixel_center_offset.x),
                    .y = round(window_center.y - pixel_center_offset.y)};
  return pixel;
}

/**
 * Converts an SDL key code to a char.
 * 7-bit ASCII characters are just returned
 * and arrow keys are given special character codes.
 */
char get_keycode(SDL_Keycode key) {
    char code = '\0';

    switch (key) {
        case SDLK_LEFT:
            code = LEFT_ARROW;
            break;

        case SDLK_UP:
            code = UP_ARROW;
            break;

        case SDLK_RIGHT:
            code = RIGHT_ARROW;
            break;

        case SDLK_DOWN:
            code = DOWN_ARROW;
            break;

        case SDLK_SPACE:
            code = SPACE_BAR;
            break;

        default:
            if ((SDL_Keycode)(char)key == key) {
                code = (char)key;
            }
            break;
    }

    return code;
}


void sdl_init(vector_t min, vector_t max) {
  assert(min.x < max.x);
  assert(min.y < max.y);

  center = vec_multiply(0.5, vec_add(min, max));
  max_diff = vec_subtract(max, center);
  SDL_Init(SDL_INIT_EVERYTHING);
  window = SDL_CreateWindow(WINDOW_TITLE, SDL_WINDOWPOS_CENTERED,
                            SDL_WINDOWPOS_CENTERED, WINDOW_WIDTH, WINDOW_HEIGHT,
                            SDL_WINDOW_RESIZABLE);
  renderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_PRESENTVSYNC);
}

bool sdl_is_done(state_t *state) {
    SDL_Event *event = malloc(sizeof(*event));
    assert(event);

    while (SDL_PollEvent(event)) {
        switch (event->type) {
            case SDL_QUIT:
                free(event);
                return true;

            case SDL_KEYDOWN:
            case SDL_KEYUP:
                if (!key_handler) {
                    break;
                }
                if (state->screen == MENU ||
                    state->screen == STATS ||
                    state->screen == INSTRUCTIONS) {
                    break;
                }

                {
                    char key = get_keycode(event->key.keysym.sym);
                    if (!key) {
                        break;
                    }

                    uint32_t timestamp = event->key.timestamp;
                    if (!event->key.repeat) {
                        key_start_timestamp = timestamp;
                    }

                    key_event_type_t type =
                        (event->type == SDL_KEYDOWN)
                            ? KEY_PRESSED
                            : KEY_RELEASED;
                    double held_time =
                        (timestamp - key_start_timestamp) / MS_PER_S;

                    key_handler(key, type, held_time, state);
                }
                break;

            case SDL_MOUSEBUTTONDOWN:
                if (!key_handler) {
                    break;
                }
                if (state->screen == GAME) {
                    break;
                }

                {
                    int x = event->button.x;
                    int y = event->button.y;
                    vector_t *location = malloc(sizeof(vector_t));
                    location->x = x;
                    location->y = y;

                    list_t *info_list = list_init(2, NULL);
                    list_add(info_list, state);
                    list_add(info_list, location);

                    key_handler(MOUSE, BUTTON, 0, info_list);
                }
                break;
        }
    }

    free(event);
    return false;
}


void sdl_clear(void) {
  SDL_SetRenderDrawColor(renderer, 255, 255, 255, 255);
  SDL_RenderClear(renderer);
}

void sdl_draw_body(body_t *body) {
  list_t *points = body_get_shape(body);
  size_t n = list_size(points);
  assert(n >= 3);
  color_t color = body_get_color(body);
  double r = color.red;
  double g = color.green;
  double b = color.blue;

  assert(0 <= r && r <= 1);
  assert(0 <= g && g <= 1);
  assert(0 <= b && b <= 1);

  vector_t window_center = get_window_center();

  int16_t *x_points = malloc(sizeof(*x_points) * n),
          *y_points = malloc(sizeof(*y_points) * n);
  assert(x_points );
  assert(y_points );
  for (size_t i = 0; i < n; i++) {
    vector_t *vertex = list_get(points, i);
    vector_t pixel = get_window_position(*vertex, window_center);
    x_points[i] = pixel.x;
    y_points[i] = pixel.y;
  }

  filledPolygonRGBA(renderer, x_points, y_points, n, r * 255, g * 255, b * 255,
                    255);
  sdl_show();
  free(x_points);
  free(y_points);
  list_free(points);
}

SDL_Texture *sdl_get_image_texture(const char *image_path) {
  SDL_Texture *img = IMG_LoadTexture(renderer, image_path);
  return img;
}

SDL_Rect *sdl_get_rect(double x, double y, double w, double h) {
  SDL_Rect *rect = malloc(sizeof(SDL_Rect));
  rect->x = x;
  rect->y = y;
  rect->w = w;
  rect->h = h;
  return rect;
}

void sdl_render_image(SDL_Texture *image_texture, SDL_Rect *rect) {
  SDL_RenderCopy(renderer, image_texture, NULL, rect);
}

void sdl_show(void) {
  vector_t window_center = get_window_center();
  vector_t max = vec_add(center, max_diff),
           min = vec_subtract(center, max_diff);
  vector_t max_pixel = get_window_position(max, window_center),
           min_pixel = get_window_position(min, window_center);
  SDL_Rect *boundary = malloc(sizeof(*boundary));
  boundary->x = min_pixel.x;
  boundary->y = max_pixel.y;
  boundary->w = max_pixel.x - min_pixel.x;
  boundary->h = min_pixel.y - max_pixel.y;
  SDL_SetRenderDrawColor(renderer, 0, 0, 0, 255);
  SDL_RenderDrawRect(renderer, boundary);
  free(boundary);

  SDL_RenderPresent(renderer);
}

void sdl_render_scene(scene_t *scene) {
  sdl_clear();
  size_t body_count = scene_bodies(scene);
  for (size_t i = 0; i < body_count; i++) {
    body_t *body = scene_get_body(scene, i);
    sdl_draw_body(body);
  }
  sdl_show();
}

void sdl_on_key(key_handler_t handler) { key_handler = handler; }

double time_since_last_tick(void) {
  clock_t now = clock();
  double difference = last_clock
                          ? (double)(now - last_clock) / CLOCKS_PER_SEC
                          : 0.0; 
  last_clock = now;
  return difference;
}

SDL_Surface *sdl_make_surface(const char *message, TTF_Font *font,
                              SDL_Color color) {
  assert(font);
  assert(message);
  SDL_Surface *surface_message = TTF_RenderUTF8_Solid(font, message, color);
  return surface_message;
}

SDL_Texture *sdl_text_texture(SDL_Surface *surface_message) {
  SDL_Texture *text = SDL_CreateTextureFromSurface(renderer, surface_message);
  return text;
}


SDL_Color sdl_convert_color(color_t color) {
  return (SDL_Color){255 * color.red, 255 * color.green, 255 * color.blue, 255};
  }
  
SDL_Rect sdl_get_body_bounding_box(body_t *body){
    list_t *vertices = body_get_shape(body);
    size_t len = list_size(vertices);
    vector_t bottom_right = {-__DBL_MAX__, __DBL_MAX__};
    vector_t top_left = {__DBL_MAX__, -__DBL_MAX__};
    for (size_t i = 0; i < len; i++){
      vector_t *position = list_get(vertices, i);
      if (position->x < top_left.x){
        top_left.x = position->x;
      }
      if (position->y > top_left.y){
        top_left.y = position->y;
      }
      if (position->x > bottom_right.x){
        bottom_right.x = position->x;
      }
      if (position->y < bottom_right.y){
        bottom_right.y = position->y;
      }
    }

    vector_t window_center = get_window_center();
    vector_t pixel_TL = get_window_position(top_left, window_center);
    vector_t pixel_BR = get_window_position(bottom_right, window_center);
    double_t width = pixel_BR.x - pixel_TL.x;
    double_t height = pixel_BR.y - pixel_TL.y;
    SDL_Rect *bounding_box = sdl_get_rect(pixel_TL.x, pixel_TL.y, width, height);
    list_free(vertices);
    return *bounding_box;
  }
