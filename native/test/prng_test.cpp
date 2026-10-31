// SPDX-License-Identifier: GPL-3.0-or-later
// Known-answer test for the PCG32 generator that replaces libc rand() (spec §5.3).
#include "check.h"
#include "prng.h"

int main() {
  dm_srand(42);
  CHECK(dm_rand() == 1635433963);
  CHECK(dm_rand() == 897835604);
  CHECK(dm_rand() == 962320717);

  dm_srand(1);
  CHECK(dm_rand() == 706385599);
  CHECK(dm_rand() == 895549723);
  CHECK(dm_rand() == 62156454);

  dm_srand(42);
  CHECK(dm_rand() == 1635433963);

  dm_srand(4294967295u);
  for (int i = 0; i < 10000; ++i) {
    int v = dm_rand();
    CHECK(v >= 0 && v <= 2147483647);
  }
  return TEST_RESULT();
}
