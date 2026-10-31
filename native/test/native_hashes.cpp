// SPDX-License-Identifier: GPL-3.0-or-later
// Native reference build: FNV-1a hashes of the cells for every vendored design and seed,
// plus the output layers of every design at seed 42.
// Its output is the golden file the WebAssembly build must match byte for byte (spec §5.3).
#include <cinttypes>
#include <initializer_list>
#include <cstdio>
#include <iostream>
#include <map>
#include <string>

#include "bridge.h"
#include "design_util.h"

static constexpr uint32_t kFnvOffset = 2166136261u;

/** FNV-1a over `len` bytes, continuing from `h`; multi-byte values in host order (LE). */
static uint32_t fnv1a32(const void* data, size_t len, uint32_t h = kFnvOffset) {
  const uint8_t* bytes = static_cast<const uint8_t*>(data);
  for (size_t i = 0; i < len; ++i) {
    h ^= bytes[i];
    h *= 16777619u;
  }
  return h;
}

static std::string hex32(uint32_t h) {
  char hex[9];
  std::snprintf(hex, sizeof hex, "%08" PRIx32, h);
  return hex;
}

static bool hash_into(std::map<std::string, std::string>& out, const std::string& key,
                      const std::string& text, uint32_t seed) {
  if (dm_generate(text.c_str(), seed, 0) != 0) {
    std::fprintf(stderr, "%s: %s\n", key.c_str(), dm_last_error());
    return false;
  }
  out[key] = hex32(fnv1a32(dm_cells(), static_cast<size_t>(dm_width()) * dm_height()));
  return true;
}

/** The four layer keys of one design: "<d>:<seed>+rooms|+entities|+baked|+steps". */
static bool hash_layers_into(std::map<std::string, std::string>& out, const std::string& prefix,
                             const std::string& text, uint32_t seed) {
  const uint32_t layer_flags[] = {DM_OUTPUT_ROOMS, DM_OUTPUT_ENTITIES_LIST, DM_OUTPUT_ENTITIES_BAKED,
                                  DM_OUTPUT_STEPS};
  const char* names[] = {"rooms", "entities", "baked", "steps"};
  for (int i = 0; i < 4; ++i) {
    const std::string key = prefix + "+" + names[i];
    if (dm_generate(text.c_str(), seed, layer_flags[i]) != 0) {
      std::fprintf(stderr, "%s: %s\n", key.c_str(), dm_last_error());
      return false;
    }
    const size_t cells = static_cast<size_t>(dm_width()) * dm_height();
    uint32_t h = kFnvOffset;
    switch (layer_flags[i]) {
      case DM_OUTPUT_ROOMS:
        h = fnv1a32(dm_room_ids(), cells * sizeof(uint16_t), h);
        h = fnv1a32(dm_rooms(), dm_room_count() * 6 * sizeof(int32_t), h);
        break;
      case DM_OUTPUT_ENTITIES_LIST:
        h = fnv1a32(dm_entities(), dm_entity_count() * 4 * sizeof(int32_t), h);
        break;
      case DM_OUTPUT_ENTITIES_BAKED:
        h = fnv1a32(dm_cells(), cells, h);
        break;
      case DM_OUTPUT_STEPS: {
        const uint32_t frames = dm_step_count();
        const uint32_t total = dm_step_offsets()[frames];
        h = fnv1a32(dm_step_offsets(), (frames + 1) * sizeof(uint32_t), h);
        h = fnv1a32(dm_step_indices(), total * sizeof(uint32_t), h);
        h = fnv1a32(dm_step_cells(), total, h);
        break;
      }
    }
    out[key] = hex32(h);
  }
  return true;
}

int main() {
  // The library reports warnings on std::cout; keep stdout for the JSON only.
  std::cout.rdbuf(nullptr);
  const char* designs[] = {"design",  "design2",     "design3A",     "design3WithTunnelers",
                           "design4A", "design5",     "design6",      "design7",
                           "designEmpty", "designEmpty2", "designOld1"};
  const uint32_t seeds[] = {1u, 2u, 3u, 42u, 4294967295u};
  std::map<std::string, std::string> hashes;
  bool ok = true;
  for (const char* d : designs) {
    const std::string text = read_design(d);
    for (uint32_t s : seeds) ok &= hash_into(hashes, std::string(d) + ":" + std::to_string(s), text, s);
    // Output layers (spec §7.2); requesting them must leave the cell hashes above untouched.
    ok &= hash_layers_into(hashes, std::string(d) + ":42", text, 42u);
  }
  // Designs with one record missing must still be deterministic: every Config field needs a
  // defined value (patch 0002), otherwise results depend on stack garbage and the compiler.
  const std::string design2 = read_design("design2");
  for (const char* tag : {"T", "M", "N", "PR", "PT", "PU", "U", "K", "F", "GS", "GB"}) {
    ok &= hash_into(hashes, std::string("design2[-") + tag + "]:42", drop_record(design2, tag), 42u);
  }
  ok &= hash_into(hashes, "design[1024x1024]:42", with_dimensions(read_design("design"), 1024, 1024), 42u);
  if (!ok) return 1;

  std::string json = "{\n";
  size_t i = 0;
  for (const auto& [key, hex] : hashes) {
    json += "  \"" + key + "\": \"" + hex + "\"" + (++i < hashes.size() ? ",\n" : "\n");
  }
  json += "}\n";
  std::fputs(json.c_str(), stdout);
  return 0;
}
