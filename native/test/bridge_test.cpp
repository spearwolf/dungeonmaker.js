// SPDX-License-Identifier: GPL-3.0-or-later
// Status codes and safety checks of the C ABI bridge (spec §5.2, §5.4).
#include <cstring>
#include <string>

#include "bridge.h"
#include "check.h"
#include "design_util.h"

static bool error_contains(const char* needle) {
  return std::strstr(dm_last_error(), needle) != nullptr;
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

  CHECK(dm_generate(design.c_str(), 42, 0) == 0);
  dm_reset();
  CHECK(dm_width() == 0);
  CHECK(dm_cells() == nullptr);

  return TEST_RESULT();
}
