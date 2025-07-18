#ifndef __ASSET_H__
#define __ASSET_H__

#include <SDL2/SDL_image.h>
#include <SDL2/SDL_ttf.h>
#include <color.h>
#include <sdl_wrapper.h>
#include <stddef.h>
#include <state.h>

#include "body.h"


typedef enum { ASSET_IMAGE, ASSET_TEXT } asset_type_t;

typedef struct asset asset_t;

/**
 * An enum for specifying the type of message_t object: 
 * a REG_MESSAGE is one that does not need to be
 * re-formatted everytime and is just a 'static' message.
 * A FORMATTED_MESSAGE must be re-formatted every time
 * because the value it needs to display changes within each 
 * iteration of the game loop, such as the user's points.
 */
typedef enum { REG_MESSAGE, FORMATTED_MESSAGE } message_type_t;

/**
 * A message_t which stores all the important information
 * needed for rendering a text. The type of the message
 * is the message_type_t enum.
 */
typedef struct message {
  message_type_t type;
  const char *text;
  const char *filepath;
  color_t color;
  vector_t location;
  bool is_button;
  func_type_t function;
} message_t;

/**
 * This struct inherits from the standard message_t 
 * because a message that needs extra formatting must
 * store additional information.
 */
typedef struct formatted_message {
  message_t message;
  value_type_t val_type;
  size_t value;
  char buffer[];
} formatted_message_t;

/**
 * A text_t which is the way that you can store all
 * kinds of text that you eventually want to convert into
 * an asset -- this is the struct that you can use to
 * hard code your input to the actual asset which can take a
 * text_t, convert it to message_t to know if additional 
 * formatting is requires, whether it has a button and if so
 * its functionality.
 */
typedef struct text {
  message_type_t type;
  const char *text;
  const char *font_path;
  vector_t location;
  color_t color;
  value_type_t val_type;
  bool is_button;
  func_type_t function;
} text_t;

/**
 * Allocates memory for an image asset with the given parameters and adds it
 * to the internal asset list.
 *
 * @param filepath the filepath to the image file
 * @param bounding_box the bounding box containing the location and dimensions
 * of the text when it is rendered
 */
void asset_make_image(const char *filepath, SDL_Rect bounding_box);


/**
 * Converts a text_t type into a message_t type.
 * Adds this to a list of messages. (effectively
 * like a cache for text since most of the text info
 * remains the same with each iteration).
 * 
 * @param tex the text_t object
 */
void asset_init_message(text_t tex);

/**
 * Resets the currently selected internal message list 
 * by freeing all assets and creating a new empty
 * list. This is useful when transitioning between scenes
 * or levels.
 */
void asset_reset_message_list();

/**
 * Converts all elements contained within the current message
 * list into an asset. Uses the information provided
 * within the message_t struct to appropriately format
 * any texts such as inputting the current number of points.
 * @param state
 */
void asset_message_to_asset(state_t *state);

/**
 * Frees all the entries in the message list
 * as well as the space allocated for the list itself.
 */
void asset_message_list_destroy();

/**
 * Gets the dimensions for a text so that it knows how big to draw
 * the textbox.
 * @param text
 */
vector_t get_dimensions_for_text(const char *text);

/**
 * Returns the current message list.
 */
list_t *asset_get_message_list();

/**
 * Given that there are some messages that 'don't talk to each other'
 * (i.e. one set of messages is only rendered during the game whereas
 * anotehr set is only rendered during the menu display), it makes
 * sense to keep them in separate message lists. This function
 * enables you to internally switch between your two lists. However,
 * the user themself is required to keep track of their switches. 
 */
void asset_switch_message_list();

/**
 * Functionality as above but aplied to assets.
 */
void asset_switch_list();

/**
 * Frees all the entries in the asset list
 * as well as the space allocated for the list itself.
 */
void asset_list_destroy();



/**
 * Allocates memory for an image asset with an attached body and adds it
 * to the internal asset list. When the asset is rendered, the image will be
 * rendered on top of the body.
 *
 * @param filepath the filepath to the image file
 * @param body the body to render the image on top of
 */
void asset_make_image_with_body(const char *filepath, body_t *body);

/**
 * Allocates memory for a text asset with the given parameters and adds it
 * to the internal asset list.
 *
 * @param filepath the filepath to the .ttf file
 * @param bounding_box the bounding box containing the location and dimensions
 * of the text when it is rendered
 * @param text the text to render
 * @param color the color of the text
 */
void asset_make_text(const char *filepath, SDL_Rect bounding_box,
                     const char *text, color_t color);

/**
 * Resets the internal asset list by freeing all assets and creating a new empty
 * list. This is useful when transitioning between scenes or levels.
 */
void asset_reset_asset_list();

/**
 * Returns the internal list of all assets that have been created.
 *
 * @return a pointer to the list containing all assets
 */
list_t *asset_get_asset_list();

/**
 * Removes and destroys all image assets associated with the given body.
 * This is typically called when a body is destroyed to clean up its visual
 * representation.
 *
 * @param body the body whose associated assets should be removed
 */
void asset_remove_body(body_t *body);

/**
 * Renders the asset to the screen.
 * @param asset the asset to render
 */
void asset_render(asset_t *asset);

/**
 * Frees the memory allocated for the asset.
 * @param asset the asset to free
 */
void asset_destroy(asset_t *asset);

#endif // #ifndef __ASSET_H__
