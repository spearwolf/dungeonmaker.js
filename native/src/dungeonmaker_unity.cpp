// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * Modification of DungeonMaker 2.05 (marked per GPL, see NOTICE)
 * What: compiles the unmodified vendored DungeonMaker.cpp with rand()/srand()
 *       redirected to the portable PCG32 generator from prng.h.
 * Why:  platform-independent determinism without touching the vendor file (spec §5.3).
 * Date: 2026-10-31
 *
 * Order matters: every standard header the vendor code includes must be loaded
 * BEFORE the macros below. Otherwise e.g. <algorithm> would see `std::dm_rand`
 * and fail to compile.
 */
#include <algorithm>
#include <cassert>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <fstream>
#include <iostream>
#include <list>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

#include "prng.h"

#define rand dm_rand
#define srand dm_srand
#include "../vendor/dungeonmaker-2.05/DungeonMaker.cpp"
#undef rand
#undef srand
