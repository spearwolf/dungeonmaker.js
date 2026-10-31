// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * Modification of DungeonMaker 2.05 (marked per GPL, see NOTICE)
 * What: C ABI bridge replacing the 2009 createdungeon.cpp: parses via
 *       Config::AcceptDesign, generates, exports cells as uint8_t north-up, and on request
 *       the room, entity and step layers as flat tables in screen coordinates.
 * Why:  status codes instead of exit(1), compact output (spec §5.2, §5.4, §7.2).
 * Date: 2026-10-31
 */
#include "bridge.h"

#include <cctype>
#include <cstring>
#include <sstream>
#include <string>
#include <vector>

#include "DungeonMaker.h"

static_assert(alifegames::COLUMN == 19, "cell numbering follows SquareData");

namespace {

std::vector<uint8_t> g_cells;
uint32_t g_width = 0;
uint32_t g_height = 0;
std::string g_error;
std::vector<uint16_t> g_room_ids;
std::vector<int32_t> g_rooms;
std::vector<int32_t> g_entities;
std::vector<uint32_t> g_step_offsets;
std::vector<uint32_t> g_step_indices;
std::vector<uint8_t> g_step_cells;

constexpr int kMinDim = 3;
constexpr int kMaxDim = 4096;
// PlonkDownStuff draws rand() % (dim - 3): a 3-wide map would divide by zero.
constexpr int kMinEntityDim = 4;
constexpr size_t kMaxRooms = 65535;  // room ids are uint16_t, 0 = no room
constexpr uint32_t kKnownFlags =
    DM_OUTPUT_ROOMS | DM_OUTPUT_ENTITIES_LIST | DM_OUTPUT_ENTITIES_BAKED | DM_OUTPUT_STEPS;

template <typename T>
void release(std::vector<T>& v) {
  std::vector<T>().swap(v);
}

template <typename T>
const T* data_or_null(const std::vector<T>& v) {
  return v.empty() ? nullptr : v.data();
}

int32_t fail(int32_t status, const std::string& message) {
  g_error = message;
  return status;
}

/** First non-whitespace character of a line, or '\0'. */
char first_char(const std::string& line) {
  for (char c : line) {
    if (!std::isspace(static_cast<unsigned char>(c))) return c;
  }
  return '\0';
}

/**
 * The parser reads opening directions after a D record until it meets the token XX;
 * without one it loops forever. Returns false when there is no D record (missing)
 * or no XX token after the last one (unterminated).
 */
bool check_d_record(const char* text, std::string& message) {
  std::istringstream in(text);
  std::string line;
  std::vector<std::string> lines;
  int last_d = -1;
  while (std::getline(in, line)) {
    char c = first_char(line);
    if (c == 'D' || c == 'd') last_d = static_cast<int>(lines.size());
    lines.push_back(line);
  }
  if (last_d < 0) {
    message = "missing D record";
    return false;
  }
  for (size_t i = static_cast<size_t>(last_d); i < lines.size(); ++i) {
    std::istringstream tokens(lines[i]);
    std::string token;
    if (i == static_cast<size_t>(last_d)) tokens >> token;  // skip the record tag itself
    while (tokens >> token) {
      if (token == "XX") return true;
    }
  }
  message = "D record must be followed by an XX line";
  return false;
}

/**
 * Preconditions of DungeonMaker::Init_fromConfig/generate that would otherwise assert,
 * read out of bounds or never return.
 */
bool check_config(const alifegames::Config& c, std::string& message) {
  if (c.dX < kMinDim || c.dX > kMaxDim || c.dY < kMinDim || c.dY > kMaxDim) {
    message = "map dimensions must be within 3..4096";
    return false;
  }
  const struct {
    const std::vector<int>& values;
    const char* record;
  } exact11[] = {{c.BDPFGC, "BC"}, {c.BDPFGR, "BR"}, {c.BDPFGT, "BT"}};
  for (const auto& e : exact11) {
    if (e.values.size() != 11) {
      message = std::string(e.record) + " record must have 11 entries";
      return false;
    }
  }
  const struct {
    const std::vector<int>& values;
    const char* record;
  } non_empty[] = {{c.SL, "S"},   {c.CW, "C"},   {c.MAC, "AC"},   {c.MAT, "AT"},
                   {c.jP, "J"},   {c.sUpP, "ZU"}, {c.sDownP, "ZD"}};
  for (const auto& e : non_empty) {
    if (e.values.empty()) {
      message = std::string("missing ") + e.record + " record";
      return false;
    }
  }
  // A builder whose generation lies below the active one is skipped by StepAhead() and
  // never removed, so AdvanceGeneration() keeps finding builders and generate() never
  // returns. Generations start at 0; only design seeds and the sizeUpGenDelay offset of
  // wider tunneler offspring can go below that.
  for (const auto& crawler : c.Crawlers) {
    if (crawler.gen < 0) {
      message = "WS crawler generation must be >= 0";
      return false;
    }
  }
  for (const auto& pair : c.CrawlerPairs) {
    if (pair.first.gen < 0 || pair.second.gen < 0) {
      message = "WP crawler generation must be >= 0";
      return false;
    }
  }
  for (const auto& tunneler : c.Tunnelers) {
    if (tunneler.gen < 0) {
      message = "U tunneler generation must be >= 0";
      return false;
    }
  }
  if (c.sUGD < 0) {
    message = "sizeUpGenDelay (M record) must be >= 0";
    return false;
  }
  return true;
}

/** Room layer, captured before PlonkDownStuff re-sorts the rooms; ids in creation order. */
void capture_rooms(alifegames::DungeonMaker& dm, int dimY) {
  std::vector<alifegames::Room> rooms = dm.GetRooms();
  g_room_ids.assign(static_cast<size_t>(dm.GetDimX()) * dimY, 0);
  g_rooms.reserve(rooms.size() * 6);
  for (size_t i = 0; i < rooms.size(); ++i) {
    const std::vector<alifegames::IntCoordinate> inside = rooms[i].GetInside();
    // Library x is the row and y the column, so screen x = .second, screen y = .first.
    int32_t minX = 0, minY = 0, maxX = 0, maxY = 0;
    for (size_t k = 0; k < inside.size(); ++k) {
      const int32_t row = inside[k].first;
      const int32_t col = inside[k].second;
      if (k == 0 || col < minX) minX = col;
      if (k == 0 || row < minY) minY = row;
      if (k == 0 || col > maxX) maxX = col;
      if (k == 0 || row > maxY) maxY = row;
      g_room_ids[static_cast<size_t>(row) * dimY + col] = static_cast<uint16_t>(i + 1);
    }
    g_rooms.insert(g_rooms.end(), {rooms[i].GetInDungeon() ? 1 : 0,
                                   static_cast<int32_t>(inside.size()), minX, minY, maxX, maxY});
  }
}

/** Entity layer: mobs first, then treasure, each in library order. */
void capture_entities(alifegames::DungeonMaker& dm) {
  const std::vector<alifegames::SpawnInfo> mobs = dm.GetMOBs();
  const std::vector<alifegames::SpawnInfo> treasure = dm.GetTreas();
  g_entities.reserve((mobs.size() + treasure.size()) * 4);
  for (const auto& m : mobs) g_entities.insert(g_entities.end(), {0, m.yCoord, m.xCoord, m.type});
  for (const auto& t : treasure) g_entities.insert(g_entities.end(), {1, t.yCoord, t.xCoord, t.type});
}

/** Step layer: the recorded movie, flattened; library (x, y) becomes index x * dimY + y. */
void capture_steps(alifegames::DungeonMaker& dm, int dimY) {
  const std::vector<std::vector<alifegames::SquareInfo>> movie = dm.GetMovie();
  size_t total = 0;
  for (const auto& frame : movie) total += frame.size();
  g_step_offsets.reserve(movie.size() + 1);
  g_step_indices.reserve(total);
  g_step_cells.reserve(total);
  g_step_offsets.push_back(0);
  for (const auto& frame : movie) {
    for (const auto& sq : frame) {
      g_step_indices.push_back(static_cast<uint32_t>(sq.xCoord * dimY + sq.yCoord));
      g_step_cells.push_back(static_cast<uint8_t>(sq.type));
    }
    g_step_offsets.push_back(static_cast<uint32_t>(g_step_indices.size()));
  }
}

}  // namespace

extern "C" {

int32_t dm_generate(const char* design_text, uint32_t seed, uint32_t flags) {
  dm_reset();
  if (seed == 0) return fail(2, "seed must be in 1..4294967295");
  const bool want_list = (flags & DM_OUTPUT_ENTITIES_LIST) != 0;
  const bool want_baked = (flags & DM_OUTPUT_ENTITIES_BAKED) != 0;
  if ((flags & ~kKnownFlags) != 0 || (want_list && want_baked)) {
    return fail(3, "invalid output flags (unknown bit, or entities list and baked together)");
  }
  const bool want_rooms = (flags & DM_OUTPUT_ROOMS) != 0;
  const bool want_steps = (flags & DM_OUTPUT_STEPS) != 0;

  std::string message;
  if (design_text == nullptr) return fail(1, "missing D record");
  if (!check_d_record(design_text, message)) return fail(1, message);

  alifegames::Config config;
  if (!config.AcceptDesign(design_text)) {
    return fail(1, "design text rejected by parser (see diagnostics)");
  }
  if (!check_config(config, message)) return fail(1, message);
  if ((want_list || want_baked) && (config.dX < kMinEntityDim || config.dY < kMinEntityDim)) {
    return fail(1, "entities need a map of at least 4x4");
  }
  // With both movie flags off the library runs one iteration per generation, so recording a
  // movie would change the dungeon itself.
  if (want_steps && !config.showM && !config.storeM) {
    return fail(1, "steps need showMovie or storeMovie (N record)");
  }
  // MakeIteration only asks showM || storeM, so storeM decides what is recorded, not what is
  // generated: record for steps, and skip the movie memory otherwise.
  if (want_steps) {
    config.storeM = true;
  } else if (config.showM) {
    config.storeM = false;
  }

  alifegames::DungeonMaker dm;
  dm.Init_fromConfig(config, seed);
  dm.generate();

  const int dimX = dm.GetDimX();
  const int dimY = dm.GetDimY();
  if (want_rooms) {
    if (dm.NumberOfRooms() > kMaxRooms) return fail(1, "the rooms layer supports at most 65535 rooms");
    capture_rooms(dm, dimY);
  }
  if (want_list || want_baked) dm.PlonkDownStuff();
  if (want_baked) dm.PutPlonkOnMap();

  // Library storage Map[x * dimY + y] with x = row (north = x--) is already
  // north-up row-major with width = dimY, height = dimX.
  g_cells.resize(static_cast<size_t>(dimX) * static_cast<size_t>(dimY));
  for (int x = 0; x < dimX; ++x) {
    for (int y = 0; y < dimY; ++y) {
      g_cells[static_cast<size_t>(x) * dimY + y] = static_cast<uint8_t>(dm.GetMap(x, y));
    }
  }
  g_width = static_cast<uint32_t>(dimY);
  g_height = static_cast<uint32_t>(dimX);
  if (want_list) capture_entities(dm);
  if (want_steps) capture_steps(dm, dimY);
  return 0;
}

uint32_t dm_width(void) { return g_width; }
uint32_t dm_height(void) { return g_height; }
const uint8_t* dm_cells(void) { return data_or_null(g_cells); }
const char* dm_last_error(void) { return g_error.c_str(); }

uint32_t dm_room_count(void) { return static_cast<uint32_t>(g_rooms.size() / 6); }
const uint16_t* dm_room_ids(void) { return data_or_null(g_room_ids); }
const int32_t* dm_rooms(void) { return data_or_null(g_rooms); }

uint32_t dm_entity_count(void) { return static_cast<uint32_t>(g_entities.size() / 4); }
const int32_t* dm_entities(void) { return data_or_null(g_entities); }

uint32_t dm_step_count(void) {
  return g_step_offsets.empty() ? 0 : static_cast<uint32_t>(g_step_offsets.size() - 1);
}
const uint32_t* dm_step_offsets(void) { return data_or_null(g_step_offsets); }
const uint32_t* dm_step_indices(void) { return data_or_null(g_step_indices); }
const uint8_t* dm_step_cells(void) { return data_or_null(g_step_cells); }

void dm_reset(void) {
  release(g_cells);
  g_width = 0;
  g_height = 0;
  g_error.clear();
  release(g_room_ids);
  release(g_rooms);
  release(g_entities);
  release(g_step_offsets);
  release(g_step_indices);
  release(g_step_cells);
}

}  // extern "C"
