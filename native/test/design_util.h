// SPDX-License-Identifier: GPL-3.0-or-later
// Helpers for the native tests: load vendored designs and derive broken variants.
#pragma once
#include <fstream>
#include <sstream>
#include <string>

static std::string read_design(const std::string& name) {
  std::ifstream f("native/vendor/dungeonmaker-2.05/" + name);
  std::stringstream ss;
  ss << f.rdbuf();
  return ss.str();
}

/** Removes every line that starts with `prefix`. */
static std::string drop_lines(const std::string& text, const std::string& prefix) {
  std::istringstream in(text);
  std::string line, out;
  while (std::getline(in, line)) {
    if (line.compare(0, prefix.size(), prefix) != 0) out += line + "\n";
  }
  return out;
}

/** Removes every line whose first token is `tag` (one record type). */
static std::string drop_record(const std::string& text, const std::string& tag) {
  std::istringstream in(text);
  std::string line, out;
  while (std::getline(in, line)) {
    std::istringstream tokens(line);
    std::string first;
    tokens >> first;
    if (first != tag) out += line + "\n";
  }
  return out;
}

/** Replaces the two dimension numbers of the first D line (library dimX, dimY). */
static std::string with_dimensions(const std::string& text, int dimX, int dimY) {
  std::istringstream in(text);
  std::string line, out;
  bool done = false;
  while (std::getline(in, line)) {
    if (!done && !line.empty() && (line[0] == 'D' || line[0] == 'd')) {
      std::istringstream rec(line);
      std::string tag, x, y, rest;
      rec >> tag >> x >> y;
      std::getline(rec, rest);
      line = tag + "   " + std::to_string(dimX) + "   " + std::to_string(dimY) + rest;
      done = true;
    }
    out += line + "\n";
  }
  return out;
}

/**
 * Replaces showMovie and storeMovie (third and fourth value) of every N record. Field order:
 * seedCrawlersInTunnels tunnelCrawlerGeneration showMovie storeMovie randSeed crawlersInAnterooms.
 */
static std::string with_movie_flags(const std::string& text, int show, int store) {
  std::istringstream in(text);
  std::string line, out;
  while (std::getline(in, line)) {
    std::istringstream rec(line);
    std::string tag;
    rec >> tag;
    if (tag == "N") {
      std::string tokens[6];
      for (std::string& t : tokens) rec >> t;
      tokens[2] = std::to_string(show);
      tokens[3] = std::to_string(store);
      line = tag;
      for (const std::string& t : tokens) line += " " + t;
    }
    out += line + "\n";
  }
  return out;
}
