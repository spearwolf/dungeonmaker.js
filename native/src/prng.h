// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * Modification of DungeonMaker 2.05 (marked per GPL, see NOTICE)
 * What: portable PCG32 generator (XSH-RR) that replaces libc rand()/srand()
 *       for the vendored DungeonMaker sources.
 * Why:  libc rand() differs between platforms; the package promises byte-identical
 *       dungeons for the same design and seed everywhere (spec §5.3).
 * Date: 2026-10-31
 *
 * The constants and the seeding sequence are part of the determinism contract:
 * changing them changes every generated dungeon (major version bump).
 */
#pragma once
#include <cstdint>

static uint64_t dm_pcg_state = 0;

static inline uint32_t dm_pcg32_next(void) {
  uint64_t old = dm_pcg_state;
  dm_pcg_state = old * 6364136223846793005ULL + 1442695040888963407ULL;
  uint32_t xorshifted = (uint32_t)(((old >> 18u) ^ old) >> 27u);
  uint32_t rot = (uint32_t)(old >> 59u);
  return (xorshifted >> rot) | (xorshifted << ((32u - rot) & 31u));
}

/** Replacement for srand(). */
static inline void dm_srand(unsigned int seed) {
  dm_pcg_state = 0;
  dm_pcg32_next();
  dm_pcg_state += (uint64_t)seed;
  dm_pcg32_next();
}

/** Replacement for rand(): uniform in 0 … 2147483647 (RAND_MAX of glibc and Emscripten). */
static inline int dm_rand(void) { return (int)(dm_pcg32_next() >> 1); }
