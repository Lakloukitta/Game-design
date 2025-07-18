#include <SDL2/SDL_image.h>
#include <SDL2/SDL_ttf.h>
#include <assert.h>

#include "asset.h"
#include "asset_cache.h"
#include "color.h"
#include "sdl_wrapper.h"

const size_t TEXT_SIZE = 18;
const size_t TEXT_HEIGHT_SCALE = 2;
static list_t *ASSET_LIST = NULL;
static list_t *ASSET_LIST_2 = NULL;
static list_t *MESSAGE_LIST = NULL;
static list_t *MESSAGE_LIST2 = NULL;
const size_t INIT_CAPACITY = 5;

typedef struct asset {
  asset_type_t type;
  SDL_Rect bounding_box;
} asset_t;

typedef struct text_asset {
  asset_t base;
  TTF_Font *font;
  const char *text;
  color_t color;
} text_asset_t;

typedef struct image_asset {
  asset_t base;
  SDL_Texture *texture;
  body_t *body;
} image_asset_t;



/**
 * Allocates memory for an asset with the given parameters.
 *
 * @param ty the type of the asset
 * @param bounding_box the bounding box containing the location and dimensions
 * of the asset when it is rendered
 * @return a pointer to the newly allocated asset
 */
static asset_t *asset_init(asset_type_t ty, SDL_Rect bounding_box) {
  if (ASSET_LIST == NULL) {
    ASSET_LIST = list_init(INIT_CAPACITY, (free_func_t)asset_destroy);
  }
  asset_t *new =
      malloc(ty == ASSET_IMAGE ? sizeof(image_asset_t) : sizeof(text_asset_t));
  assert(new);
  new->type = ty;
  new->bounding_box = bounding_box;
  return new;
}

void asset_init_message(text_t tex){
  if (MESSAGE_LIST == NULL) {
    MESSAGE_LIST = list_init(INIT_CAPACITY, free);
  }
  message_t *new = malloc(tex.type == REG_MESSAGE ? sizeof(message_t) : sizeof(formatted_message_t)+sizeof(char) * (strlen(tex.text)+1));
  assert(new);
  new->type = tex.type;
  new->text = tex.text;
  new->filepath = tex.font_path;
  new->color = tex.color;
  new->location = tex.location;
  new->is_button = tex.is_button;
  new->function = tex.function;
  if (tex.type == FORMATTED_MESSAGE){
    formatted_message_t *format_new = (formatted_message_t *)new;
    format_new->val_type = tex.val_type;
  }
  list_add(MESSAGE_LIST, new);
}
/**
 * getting dimensions for text
 */
vector_t get_dimensions_for_text(const char *text) {
  return (vector_t){strlen(text) * TEXT_SIZE, TEXT_SIZE * TEXT_HEIGHT_SCALE};
}

void asset_message_to_asset(state_t *state){
  size_t num = list_size(MESSAGE_LIST);
  if (num == 0){
    return;
  }
  for (size_t i =0; i < num; i++){
    vector_t dims;
    message_t *message = list_get(MESSAGE_LIST, i);
    if (message->type == FORMATTED_MESSAGE){
      formatted_message_t *f_message = (formatted_message_t *)message;
      if (f_message->val_type == POINTS){
        sprintf(f_message->buffer, f_message->message.text, state->points);
      }
      else if (f_message->val_type == ROUNDS){
        sprintf(f_message->buffer, f_message->message.text, state->round);
    }
    else if (f_message->val_type == TIME){
      sprintf(f_message->buffer, f_message->message.text, (size_t)(state->timer - state->time));
    }
  else if (f_message->val_type == AVG){
    sprintf(f_message->buffer, f_message->message.text, state->avg_pts);
  }
    dims = get_dimensions_for_text(f_message->buffer);
    SDL_Rect *bounding_box = sdl_get_rect(f_message->message.location.x, f_message->message.location.y, dims.x, dims.y);
    asset_make_text(f_message->message.filepath, *bounding_box, f_message->buffer, f_message->message.color);
  }
  else {
    dims = get_dimensions_for_text(message->text);
    SDL_Rect *bounding_box = sdl_get_rect(message->location.x, message->location.y, dims.x, dims.y);
    asset_make_text(message->filepath, *bounding_box, message->text, message->color);
  }
}
}


void asset_switch_list(){
  list_t *temp = ASSET_LIST;
  ASSET_LIST = ASSET_LIST_2;
  ASSET_LIST_2 = temp;
}

void asset_switch_message_list(){
  list_t *temp = MESSAGE_LIST;
  MESSAGE_LIST = MESSAGE_LIST2;
  MESSAGE_LIST2 = temp;
}

void asset_make_image_with_body(const char *filepath, body_t *body) {
  SDL_Rect box = {0, 0, 0, 0};
  SDL_Texture *texture =
      (SDL_Texture *)asset_cache_obj_get_or_create(ASSET_IMAGE, filepath);
  image_asset_t *img_asset =
      (image_asset_t *)asset_init(ASSET_IMAGE, box);
  img_asset->texture = texture;
  img_asset->body = body;
  list_add(ASSET_LIST, (asset_t *)img_asset);
}


void asset_make_image(const char *filepath, SDL_Rect bounding_box) {
  SDL_Texture *texture =
      (SDL_Texture *)asset_cache_obj_get_or_create(ASSET_IMAGE, filepath);
  image_asset_t *img_asset =
      (image_asset_t *)asset_init(ASSET_IMAGE, bounding_box);
  img_asset->texture = texture;
  img_asset->body = NULL;
  list_add(ASSET_LIST, (asset_t *)img_asset);
}

void asset_make_text(const char *filepath, SDL_Rect bounding_box,
                     const char *text, color_t color) {
  TTF_Font *font =
      (TTF_Font *)asset_cache_obj_get_or_create(ASSET_TEXT, filepath);
  assert(font);
  text_asset_t *text_asset =
      (text_asset_t *)asset_init(ASSET_TEXT, bounding_box);

  text_asset->font = font;
  text_asset->text = text;
  text_asset->color = color;
  list_add(ASSET_LIST, (asset_t *)text_asset);
}

void asset_reset_asset_list() {
  if (ASSET_LIST != NULL) {
    list_free(ASSET_LIST);
  }
  ASSET_LIST = list_init(INIT_CAPACITY, (free_func_t)asset_destroy);
}

void asset_reset_message_list() {
  if (MESSAGE_LIST != NULL) {
    list_free(MESSAGE_LIST);
  }
  MESSAGE_LIST = list_init(INIT_CAPACITY, (free_func_t)asset_destroy);
}

void asset_message_list_destroy(){
  list_free(MESSAGE_LIST);
  list_free(MESSAGE_LIST2);
}

void asset_list_destroy(){
  list_free(ASSET_LIST);
  list_free(ASSET_LIST_2);
}

list_t *asset_get_asset_list() { return ASSET_LIST; }

list_t *asset_get_message_list() { return MESSAGE_LIST; }

void asset_remove_body(body_t *body) {
  for (size_t i = 0; i < list_size(ASSET_LIST); i++){
    asset_t *asset = list_get(ASSET_LIST, i);
    if (asset->type == ASSET_IMAGE){
      image_asset_t *img_asset = (image_asset_t *)asset;
      if (img_asset->body == body){
        list_remove(ASSET_LIST, i);
        asset_destroy(asset);
      }
    }
  }
}

void asset_render(asset_t *asset) {
  switch (asset->type) {
    case ASSET_IMAGE: {
      image_asset_t *img_asset = (image_asset_t *)asset;
      if (img_asset->body){
        img_asset->base.bounding_box = sdl_get_body_bounding_box(img_asset->body);
      }
      sdl_render_image(img_asset->texture, &img_asset->base.bounding_box);
      break;
    }
    case ASSET_TEXT: {
      text_asset_t *text_asset = (text_asset_t *)asset;
      assert(text_asset);
      assert(text_asset->text);
      SDL_Color col = sdl_convert_color(text_asset->color);
      SDL_Surface *text_surface =
          sdl_make_surface(text_asset->text, text_asset->font, col);
      SDL_Texture *text_texture = sdl_text_texture(text_surface);
      sdl_render_image(text_texture, &(text_asset->base.bounding_box));
      SDL_FreeSurface(text_surface);
      SDL_DestroyTexture(text_texture);
      break;
    }
    default: { break;}
    }
}

void asset_destroy(asset_t *asset) { free(asset); }
