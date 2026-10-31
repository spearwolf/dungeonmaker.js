# Design concepts

A DungeonMaker design does not draw a dungeon. It sets up a small population of agents and lets
them dig. This page explains the ideas in our own words; the original description is the manual
of DungeonMaker 2.05 by Peter Henningsen (`DM2_Manual`, shipped with the
[upstream release](http://dungeonmaker.sourceforge.net/)). Every term below links to the section
of the [design config reference](/reference/config) that lists its fields.

## Two kinds of ground

A map starts as one big block of open or closed ground (`background` in the [`map`](/reference/config#map)
section) and gets pre-placed shapes: [`rectangles`](/reference/config#rectangles) of guaranteed-open
or guaranteed-closed cells, room outlines, doors, and openings in the map border. Everything the
designer wants to be exactly where it is goes here, for example the room of a story character.

The generator then builds around these shapes with two families of builders. Where the ground is
open, **crawlers** raise walls and produce a **labyrinth**. Where the ground is closed,
**tunnelers** carve passages and rooms and produce a **dungeon**. The two areas are called
`labyrinth` and `dungeon` throughout the rest of the design, for room counts and for entity
placement.

## Crawlers

A crawler walks across open ground and leaves a wall behind it. Three numbers dominate how its
labyrinth looks:

- the corridor width, the space it keeps between its wall and other closed cells,
- the step length, how many cells it walls up per step,
- the chance to change direction at the end of a step.

Corridor width and step length are set per generation, the direction chance is inherited from the
parent with a little random mutation. That mix lets one map have regions with different character
(inherited genes follow the ancestors of a region) while generations stay compatible with each
other (per-generation values). The lists live in [`crawlers`](/reference/config#crawlers).

Crawlers enter the map in three ways: as design crawlers placed at a fixed position, as random
crawlers that start at the map border at a configured density, or as offspring of other crawlers.
Offspring and random crawlers are always open: they leave a gap at the end of their run, so a
crawler never cuts off a part of the labyrinth, and everything stays reachable. A design crawler can
be closed on purpose, to block a passage and force a path through a certain room.

## Tunnelers and roomies

Tunnelers are the more complex builders. A tunnel can have any odd width, so tunnelers carry a
width that their children may grow or shrink by probability. They can also carve **anterooms**,
small meeting places at bends and junctions, and they spawn **roomies**: builders that make at
most one step. A roomie looks for enough closed ground for the room size it wants and excavates
the whole room at once, or it removes itself.

Usually one design tunneler starts at each entrance into a closed area and at each door of a
pre-placed room. Tunnelers like to join existing passages and to break into rooms, but nothing
guarantees that two tunnel systems meet. Whoever uses the dungeon should test the connectivity
that matters (entrance to exit) and pick another seed if the test fails. The fields are in
[`tunnelers`](/reference/config#tunnelers); sizes, counts and aspect ratios of the rooms are in
[`rooms`](/reference/config#rooms).

## Generations and spawn delay

Every builder belongs to a generation. Generation N starts only after generation N-1 has died out.
A builder dies when it runs out of space or reaches its maximum age; in between it takes steps,
which build a stretch of wall or tunnel, maybe turn, and maybe spawn one or two children.

Because early generations fill the map first, **when** children appear decides what the map looks
like. [`spawnDelay`](/reference/config#spawndelay) holds, for crawlers, roomies and tunnelers,
eleven percentages that say how many generations after its parent a child is born. The values
sum to 100. Tunnelers that dig wider tunnels than their parent have their own delay in
[`tunnelers`](/reference/config#tunnelers), because wide tunnels should start far from the entrance.

## Behaviour that applies to all

[`behaviour`](/reference/config#behaviour) holds the settings every builder shares: the mutation
strength that changes inherited values between generations, the chance that a builder ignores its
intended heading, and the patience that decides how late (or whether) rooms get built in the
dungeon area.

## After the builders

When all builders are done the generator can find places in the open labyrinth that become a room
by closing a single door, and can place monsters and treasure. The upstream author calls the
monster and treasure placement a generic demonstration that every game has to adapt, which is why
it is an optional layer in this package: see [Output layers](/guide/layers) and
[`population`](/reference/config#population).

## Why a design reads like a recipe

The designer does not control individual cells. He or she controls probabilities, widths and
timing, and then watches. The [Playground](/) replays the construction step by step, which is the
quickest way to develop a feeling for these parameters, as the upstream manual also recommends:
roll the seed again and again and look at what stays the same and what changes. For orientation of
the coordinates and the meaning of cell values see [Orientation and cell values](/guide/orientation).
