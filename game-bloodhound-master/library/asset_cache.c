#include <SDL2/SDL_image.h>
#include <SDL2/SDL_ttf.h>
#include <assert.h>

#include "asset_cache.h"
#include "list.h"
#include "sdl_wrapper.h"

static list_t *ASSET_CACHE;

const size_t FONT_SIZE = 18;
const size_t INITIAL_CAPACITY = 5;

typedef struct {
  asset_type_t type;
  const char *filepath;
  void *obj;
} entry_t;

static void asset_cache_free_entry(entry_t *entry) {
  switch (entry->type) {
  case ASSET_IMAGE: {
    SDL_DestroyTexture(entry->obj);
    break;
  }
  case ASSET_TEXT: {
    TTF_CloseFont(entry->obj);
    break;
  }
  }
  free(entry);
}

void asset_cache_init() {
  ASSET_CACHE =
      list_init(INITIAL_CAPACITY, (free_func_t)asset_cache_free_entry);
}

void asset_cache_destroy() { list_free(ASSET_CACHE); }

entry_t *get_entry(asset_type_t ty, const char *filepath) {
  size_t len = list_size(ASSET_CACHE);
  for (size_t i = 0; i < len; i++) {
    entry_t *entry = (entry_t *)list_get(ASSET_CACHE, i);
    if (strcmp(entry->filepath, filepath) == 0) {
      assert(entry->type == ty);
      return entry;
    }
  }
  return NULL;
}

void *asset_cache_obj_get_or_create(asset_type_t ty, const char *filepath) {
  entry_t *entry = get_entry(ty, filepath);
  if (!entry) {
    entry_t *entry = malloc(sizeof(entry_t));
    entry->filepath = filepath;
    entry->type = ty;
    switch (ty) {
    case ASSET_IMAGE: {
      SDL_Texture *obj = sdl_get_image_texture(filepath);
      entry->obj = obj;
      break;
    }
    case ASSET_TEXT: {
      TTF_Font *obj = TTF_OpenFont(filepath, FONT_SIZE);
      entry->obj = obj;
      break;
    }
    }
    list_add(ASSET_CACHE, entry);
    return entry->obj;
  }
  return entry->obj;
}
