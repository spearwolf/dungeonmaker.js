// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * Modification of DungeonMaker 2.05 (marked per GPL, see NOTICE)
 * What: C ABI bridge replacing the 2009 createdungeon.cpp: parses via
 *       Config::AcceptDesign, generates, exports cells as uint8_t north-up.
 * Why:  status codes instead of exit(1), compact output (spec §5.2, §5.4).
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

constexpr int kMinDim = 3;
constexpr int kMaxDim = 4096;

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

}  // namespace

extern "C" {

int32_t dm_generate(const char* design_text, uint32_t seed, uint32_t flags) {
  (void)flags;
  dm_reset();
  if (seed == 0) return fail(2, "seed must be in 1..4294967295");

  std::string message;
  if (design_text == nullptr) return fail(1, "missing D record");
  if (!check_d_record(design_text, message)) return fail(1, message);

  alifegames::Config config;
  if (!config.AcceptDesign(design_text)) {
    return fail(1, "design text rejected by parser (see diagnostics)");
  }
  if (!check_config(config, message)) return fail(1, message);

  alifegames::DungeonMaker dm;
  dm.Init_fromConfig(config, seed);
  dm.generate();

  const int dimX = dm.GetDimX();
  const int dimY = dm.GetDimY();
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
  return 0;
}

uint32_t dm_width(void) { return g_width; }
uint32_t dm_height(void) { return g_height; }
const uint8_t* dm_cells(void) { return g_cells.empty() ? nullptr : g_cells.data(); }
const char* dm_last_error(void) { return g_error.c_str(); }

void dm_reset(void) {
  std::vector<uint8_t>().swap(g_cells);
  g_width = 0;
  g_height = 0;
  g_error.clear();
}

}  // extern "C"
