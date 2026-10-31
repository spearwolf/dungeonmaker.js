// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * C ABI between the WebAssembly module and JavaScript (spec §5.2).
 * One result slot per module instance; a worker generates serially anyway.
 */
#pragma once
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/*
 * Output flags for dm_generate (spec §7.2). Without a flag, the matching counters return 0 and
 * the pointers nullptr. Only DM_OUTPUT_ENTITIES_BAKED changes the cells.
 */
/** Room layer: dm_room_count, dm_room_ids, dm_rooms. */
#define DM_OUTPUT_ROOMS 1u
/** Entity layer as a list: dm_entity_count, dm_entities; the cells stay untouched. */
#define DM_OUTPUT_ENTITIES_LIST 2u
/** Entities written into the cells (MOB1..3, TREAS1..3); no list. Excludes ENTITIES_LIST. */
#define DM_OUTPUT_ENTITIES_BAKED 4u
/** Step layer (the recorded movie): dm_step_count, dm_step_offsets, dm_step_indices, dm_step_cells. */
#define DM_OUTPUT_STEPS 8u

/**
 * Status: 0 = ok, 1 = design error (see dm_last_error), 2 = invalid seed,
 * 3 = invalid flags (unknown bit, or DM_OUTPUT_ENTITIES_LIST and DM_OUTPUT_ENTITIES_BAKED together).
 * flags: bitwise OR of DM_OUTPUT_*, 0 for cells only.
 */
int32_t dm_generate(const char* design_text, uint32_t seed, uint32_t flags);
/** Width of the last result (= library dimY), 0 without result. */
uint32_t dm_width(void);
/** Height of the last result (= library dimX), 0 without result. */
uint32_t dm_height(void);
/** width*height bytes, north-up row-major (index = y*width + x), values = SquareData; nullptr without result. */
const uint8_t* dm_cells(void);
/** Message for the last non-zero status; "" after success. */
const char* dm_last_error(void);

/** Number of rooms (DM_OUTPUT_ROOMS), 0 otherwise. */
uint32_t dm_room_count(void);
/**
 * width*height room ids, same indexing as dm_cells: 0 = no room, else creation index + 1
 * (dm_rooms order); nullptr without DM_OUTPUT_ROOMS.
 */
const uint16_t* dm_room_ids(void);
/**
 * 6 values per room in creation order: inDungeon (0 = labyrinth, 1 = dungeon), size (squares),
 * minX, minY, maxX, maxY (screen coordinates, x = column, y = row, inclusive);
 * nullptr without rooms.
 */
const int32_t* dm_rooms(void);

/** Number of entities (DM_OUTPUT_ENTITIES_LIST), 0 otherwise. */
uint32_t dm_entity_count(void);
/**
 * 4 values per entity: kind (0 = mob, 1 = treasure), x, y (screen coordinates), level (index
 * in the design's population list). All mobs first, then all treasure, each in library order;
 * nullptr without entities.
 */
const int32_t* dm_entities(void);

/** Number of frames (DM_OUTPUT_STEPS), 0 otherwise. Frame 0 is the start map (every cell). */
uint32_t dm_step_count(void);
/** dm_step_count() + 1 entries; frame k spans [offsets[k], offsets[k + 1]) of indices/cells. */
const uint32_t* dm_step_offsets(void);
/** offsets[dm_step_count()] cell indices (y*width + x), in the order the library set them. */
const uint32_t* dm_step_indices(void);
/** offsets[dm_step_count()] cell values (SquareData), parallel to dm_step_indices. */
const uint8_t* dm_step_cells(void);

/** Frees all result buffers (cells and layers). */
void dm_reset(void);

#ifdef __cplusplus
}
#endif
