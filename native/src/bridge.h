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

/** Status: 0 = ok, 1 = design error (see dm_last_error), 2 = invalid seed. flags: reserved, pass 0. */
int32_t dm_generate(const char* design_text, uint32_t seed, uint32_t flags);
/** Width of the last result (= library dimY), 0 without result. */
uint32_t dm_width(void);
/** Height of the last result (= library dimX), 0 without result. */
uint32_t dm_height(void);
/** width*height bytes, north-up row-major (index = y*width + x), values = SquareData; nullptr without result. */
const uint8_t* dm_cells(void);
/** Message for the last non-zero status; "" after success. */
const char* dm_last_error(void);
/** Frees the result buffer. */
void dm_reset(void);

#ifdef __cplusplus
}
#endif
