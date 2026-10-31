// SPDX-License-Identifier: GPL-3.0-or-later
// Native reference build: FNV-1a hashes of the cells for every vendored design and seed.
// Its output is the golden file the WebAssembly build must match byte for byte (spec §5.3).
#include <cinttypes>
#include <initializer_list>
#include <cstdio>
#include <iostream>
#include <map>
#include <string>

#include "bridge.h"
#include "design_util.h"

static uint32_t fnv1a32(const uint8_t* bytes, size_t len) {
  uint32_t h = 2166136261u;
  for (size_t i = 0; i < len; ++i) {
    h ^= bytes[i];
    h *= 16777619u;
  }
  return h;
}

static bool hash_into(std::map<std::string, std::string>& out, const std::string& key,
                      const std::string& text, uint32_t seed) {
  if (dm_generate(text.c_str(), seed, 0) != 0) {
    std::fprintf(stderr, "%s: %s\n", key.c_str(), dm_last_error());
    return false;
  }
  char hex[9];
  std::snprintf(hex, sizeof hex, "%08" PRIx32,
                fnv1a32(dm_cells(), static_cast<size_t>(dm_width()) * dm_height()));
  out[key] = hex;
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
