// SPDX-License-Identifier: GPL-3.0-or-later
// Status codes and safety checks of the C ABI bridge (spec §5.2, §5.4).
#include <algorithm>
#include <cstring>
#include <string>
#include <vector>

#include "bridge.h"
#include "check.h"
#include "design_util.h"

static bool error_contains(const char* needle) {
  return std::strstr(dm_last_error(), needle) != nullptr;
}

/** The cell PutPlonkOnMap writes for an entity: level < 2, < 4, else (MOB1..3, TREAS1..3). */
static uint8_t baked_cell(int32_t kind, int32_t level) {
  const uint8_t base = kind == 0 ? 13 : 16;  // MOB1, TREAS1
  return static_cast<uint8_t>(base + (level < 2 ? 0 : level < 4 ? 1 : 2));
}

/** Replays every step frame onto a zeroed map; true when the result equals dm_cells(). */
static bool replay_matches_cells() {
  const size_t n = static_cast<size_t>(dm_width()) * dm_height();
  const uint32_t* offsets = dm_step_offsets();
  const uint32_t* indices = dm_step_indices();
  const uint8_t* cells = dm_step_cells();
  if (dm_step_count() == 0 || offsets == nullptr) return false;
  std::vector<uint8_t> map(n, 0);
  for (uint32_t k = 0; k < dm_step_count(); ++k) {
    if (offsets[k] > offsets[k + 1]) return false;
    for (uint32_t j = offsets[k]; j < offsets[k + 1]; ++j) {
      if (indices[j] >= n) return false;
      map[indices[j]] = cells[j];
    }
  }
  return std::equal(map.begin(), map.end(), dm_cells());
}

// Output layers behind the dm_generate flags (spec §7.2).
static void test_output_layers() {
  const std::string d3 = read_design("design3A");
  CHECK(dm_generate(d3.c_str(), 42, 0) == 0);
  const uint32_t width = dm_width();
  const size_t n = static_cast<size_t>(width) * dm_height();
  std::vector<uint8_t> plain(dm_cells(), dm_cells() + n);
  for (uint32_t f : {1u, 2u, 8u, 1u | 2u | 8u}) {  // layers that must not change cells
    CHECK(dm_generate(d3.c_str(), 42, f) == 0);
    CHECK(std::equal(plain.begin(), plain.end(), dm_cells()));
  }
  // storeMovie only changes what is recorded, never how the generator iterates.
  for (uint32_t f : {0u, 8u}) {
    CHECK(dm_generate(with_movie_flags(d3, 0, 1).c_str(), 42, f) == 0);
    CHECK(std::equal(plain.begin(), plain.end(), dm_cells()));
    CHECK(dm_generate(with_movie_flags(d3, 1, 1).c_str(), 42, f) == 0);
    CHECK(std::equal(plain.begin(), plain.end(), dm_cells()));
  }

  CHECK(dm_generate(d3.c_str(), 42, 2u | 4u) == 3);
  CHECK(error_contains("output flags"));
  CHECK(dm_width() == 0 && dm_cells() == nullptr);
  CHECK(dm_generate(d3.c_str(), 42, 16u) == 3);
  CHECK(error_contains("output flags"));

  CHECK(dm_generate(d3.c_str(), 42, 0) == 0);
  CHECK(dm_room_count() == 0 && dm_room_ids() == nullptr && dm_rooms() == nullptr);
  CHECK(dm_entity_count() == 0 && dm_entities() == nullptr);
  CHECK(dm_step_count() == 0 && dm_step_offsets() == nullptr);

  // Rooms: every non-zero id is in range and its cell lies inside that room's bounds.
  CHECK(dm_generate(d3.c_str(), 42, DM_OUTPUT_ROOMS) == 0);
  const uint32_t room_count = dm_room_count();
  CHECK(room_count > 0);
  CHECK(dm_entity_count() == 0 && dm_step_count() == 0);
  if (room_count > 0) {
    const uint16_t* ids = dm_room_ids();
    const int32_t* rooms = dm_rooms();
    bool ids_ok = true;
    std::vector<size_t> seen(room_count, 0);
    for (size_t i = 0; i < n; ++i) {
      if (ids[i] == 0) continue;
      if (ids[i] > room_count) {
        ids_ok = false;
        continue;
      }
      const int32_t* r = rooms + 6 * (ids[i] - 1);
      const int32_t x = static_cast<int32_t>(i % width);
      const int32_t y = static_cast<int32_t>(i / width);
      if (x < r[2] || y < r[3] || x > r[4] || y > r[5]) ids_ok = false;
      ++seen[ids[i] - 1];
    }
    CHECK(ids_ok);
    bool rooms_ok = true;
    bool has_dungeon_room = false;
    for (uint32_t k = 0; k < room_count; ++k) {
      const int32_t* r = rooms + 6 * k;
      if (r[0] != 0 && r[0] != 1) rooms_ok = false;
      if (r[0] == 1) has_dungeon_room = true;
      if (r[1] < 1 || static_cast<size_t>(r[1]) < seen[k]) rooms_ok = false;
      if (r[2] > r[4] || r[3] > r[5] || r[2] < 0 || r[3] < 0) rooms_ok = false;
      if (r[4] >= static_cast<int32_t>(width) || r[5] >= static_cast<int32_t>(dm_height())) rooms_ok = false;
      if (seen[k] == 0) rooms_ok = false;
    }
    CHECK(rooms_ok);
    CHECK(has_dungeon_room);
  }

  // Steps: frame 0 is the whole start map, replaying all frames yields the cells.
  CHECK(dm_generate(d3.c_str(), 42, DM_OUTPUT_STEPS) == 0);
  CHECK(dm_step_count() > 1);
  CHECK(dm_step_offsets()[0] == 0 && dm_step_offsets()[1] == dm_width() * dm_height());
  CHECK(replay_matches_cells());
  CHECK(dm_room_count() == 0 && dm_entity_count() == 0);

  // Entities: list and baked share positions; baked differs from the plain cells exactly there.
  CHECK(dm_generate(d3.c_str(), 42, DM_OUTPUT_ENTITIES_LIST) == 0);
  const uint32_t entity_count = dm_entity_count();
  CHECK(entity_count > 0);
  std::vector<int32_t> entities(dm_entities(), dm_entities() + 4 * entity_count);
  bool order_ok = true;
  bool kinds[2] = {false, false};
  std::vector<uint8_t> expected = plain;
  for (uint32_t k = 0; k < entity_count; ++k) {
    const int32_t kind = entities[4 * k];
    const int32_t x = entities[4 * k + 1];
    const int32_t y = entities[4 * k + 2];
    const int32_t level = entities[4 * k + 3];
    if (kind != 0 && kind != 1) order_ok = false;
    if (k > 0 && kind < entities[4 * (k - 1)]) order_ok = false;  // mobs first
    if (x < 0 || y < 0 || x >= static_cast<int32_t>(width) || y >= static_cast<int32_t>(dm_height()) ||
        level < 0) {
      order_ok = false;
      continue;
    }
    kinds[kind == 1] = true;
    expected[static_cast<size_t>(y) * width + x] = baked_cell(kind, level);
  }
  CHECK(order_ok);
  CHECK(kinds[0] && kinds[1]);
  CHECK(dm_generate(d3.c_str(), 42, DM_OUTPUT_ENTITIES_BAKED) == 0);
  CHECK(dm_entity_count() == 0 && dm_entities() == nullptr);
  CHECK(std::equal(expected.begin(), expected.end(), dm_cells()));
  CHECK(!std::equal(plain.begin(), plain.end(), dm_cells()));
  // Baked entities are part of the recorded steps as well.
  CHECK(dm_generate(d3.c_str(), 42, DM_OUTPUT_ENTITIES_BAKED | DM_OUTPUT_STEPS) == 0);
  CHECK(std::equal(expected.begin(), expected.end(), dm_cells()));
  CHECK(replay_matches_cells());

  // Rejections that protect the generator.
  CHECK(dm_generate(with_dimensions(d3, 3, 50).c_str(), 42, DM_OUTPUT_ENTITIES_LIST) == 1);
  CHECK(error_contains("entities need a map of at least 4x4"));
  CHECK(dm_generate(with_dimensions(d3, 50, 3).c_str(), 42, DM_OUTPUT_ENTITIES_BAKED) == 1);
  CHECK(error_contains("entities need a map of at least 4x4"));
  CHECK(dm_generate(with_movie_flags(d3, 0, 0).c_str(), 42, DM_OUTPUT_STEPS) == 1);
  CHECK(error_contains("steps need showMovie or storeMovie"));
}

int main() {
  const std::string design = read_design("design");
  CHECK(!design.empty());

  CHECK(dm_generate(design.c_str(), 42, 0) == 0);
  CHECK(std::strcmp(dm_last_error(), "") == 0);
  CHECK(dm_width() == 200);
  CHECK(dm_height() == 80);
  CHECK(dm_cells() != nullptr);

  CHECK(dm_generate(design.c_str(), 0, 0) == 2);
  CHECK(error_contains("seed must be in 1..4294967295"));

  CHECK(dm_generate("", 1, 0) == 1);
  CHECK(error_contains("missing D record"));

  CHECK(dm_generate("D 50 50 CLOSED 12 18 NO", 1, 0) == 1);
  CHECK(error_contains("D record must be followed by an XX line"));

  CHECK(dm_generate((design + "\nWPX\n").c_str(), 1, 0) == 1);
  CHECK(error_contains("design text rejected by parser"));

  CHECK(dm_generate(with_dimensions(design, 5000, 5000).c_str(), 1, 0) == 1);
  CHECK(error_contains("map dimensions must be within 3..4096"));

  CHECK(dm_generate(drop_lines(design, "BC").c_str(), 1, 0) == 1);
  CHECK(error_contains("BC record must have 11 entries"));

  CHECK(dm_generate(drop_lines(design, "S ").c_str(), 1, 0) == 1);
  CHECK(error_contains("missing S record"));

  // Malformed tokens must be rejected, never loop forever or read uninitialized values.
  const std::string malformed[] = {
      design + "\nT  abc 25 70 250 0 0 0 40 20 2\n",
      "XX x\nD abc 50 CLOSED 12 18 NO\nXX\n" + design,
      "XX x\nD 99999999999 50 CLOSED 12 18 NO\nXX\n" + design,
      design + "\nR 1 1 5 x CLOSED\n",
      design + "\nS 5 3",
      design + "\nJ 5 3",
      design + "\nGS 50 50 0",
      design + "\nR 2 2 6 6 FOO\n",
      "XX x\nD 50 50 CLOSED 12 18 WEE\nXX\n" + design,
      "S 3 0 D 50 50 CLOSED 12 18 NO",
  };
  for (const std::string& text : malformed) {
    CHECK(dm_generate(text.c_str(), 1, 0) == 1);
  }

  // A builder below the active generation never runs and is never removed, so the
  // generator would advance generations forever. The bridge must reject these designs.
  const std::string design5 = read_design("design5");
  const struct {
    std::string text;
    const char* message;
  } endless[] = {
      {design5 + "\nWS 50 50 NO NO 0 20 -1 3 1 1 0 30 0 60 40\n", "WS crawler generation"},
      {design5 + "\nWP1 50 50 NO NO 0 20 0 3 2 7 0 30 0 50 40\n"
                 "WP2 50 50 SO SO 0 20 -1 3 2 7 0 30 0 50 40\n",
       "WP crawler generation"},
      {design + "\nU 40 2 EA EA 0 16 -1 5 1 25 50 30 100 100 100\n", "U tunneler generation"},
      {drop_record(design, "M") + "\nM 20 40 90 -1 0 0 0.6 2\n", "sizeUpGenDelay"},
  };
  for (const auto& e : endless) {
    CHECK(dm_generate(e.text.c_str(), 1, 0) == 1);
    CHECK(error_contains(e.message));
  }

  test_output_layers();

  CHECK(dm_generate(design.c_str(), 42, DM_OUTPUT_ROOMS | DM_OUTPUT_ENTITIES_LIST | DM_OUTPUT_STEPS) == 0);
  dm_reset();
  CHECK(dm_width() == 0);
  CHECK(dm_cells() == nullptr);
  CHECK(dm_room_count() == 0 && dm_room_ids() == nullptr && dm_rooms() == nullptr);
  CHECK(dm_entity_count() == 0 && dm_entities() == nullptr);
  CHECK(dm_step_count() == 0 && dm_step_offsets() == nullptr && dm_step_indices() == nullptr &&
        dm_step_cells() == nullptr);

  return TEST_RESULT();
}
