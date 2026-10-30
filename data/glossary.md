# Glossary

The source of truth for what each word in this tool means. Strings, tests, the plan and the README use a term in the sense given here. The page shows a definition when a reader hovers the term.

Write each entry as a `### Term` heading, then one or two plain sentences, then an optional `Not:` line listing words that must not be used for it. A number a rule decides is a `{placeholder}` the core fills, so the glossary cannot disagree with the rules. Keep entries in alphabetical order. `crates/core/tests/copy.rs` checks the format, the placeholders and the `Not:` words; `TONE.md` governs the prose.

<!--
An example entry. It sits inside this comment, so it does not count.

### Spout

Where slush comes out. Each line has up to {line.spouts} spouts.

Not: tap, dispenser, nozzle
-->

### Belt

Carries items along two lanes in the direction it faces. An item reaching an open end disappears.

Not: conveyor

### Best time

The fastest finish of the day's daily game, kept between visits. A new day starts with none.

Not: record, high score

### Color

One of five base colors (red, yellow, blue, black, white) or one of the ten colors two base colors mix to: orange, green, purple, pink, cream, sky, gray, maroon, ochre, navy.

### Cutter

The machine that cuts a plate or stack to one shape, chosen in its panel. What is cut away is gone.

### Daily game

A Medium game with the same map and recipe for every player on the same day.

### Delivered

An item that reached the exit looking the same as the recipe.

### Difficulty

How many steps the recipe takes: easy, medium or hard.

### Drill

Mines ore from the field under it and drops it on the belt at its spout. The ore never runs out.

Not: miner

### Edge pan

Moves the view when the pointer is at the screen's edge: off, slow, normal or fast.

### Exit

The fixed block where finished items are delivered. Items go in on its belt and disappear in the middle.

Not: output belt, sink

### Forge

Turns ore, paste, or liquid from a pipe into a plate of the same color, one kind at a time.

Not: furnace, smelter, freezer, kiln

### Host

The player who opened an online game's lobby. The host picks the difficulty and map size, starts the game and calls the rematch.

### Hotbar

The row of buildings on the number keys.

### Inserter

Picks an item up from behind and drops it in front, taking only what the machine in front can use.

### Liquid

What a lake holds, one color to a lake. Pumps draw it and pipes carry it.

### Lobby

Where the players of an online game gather before it starts.

### Long inserter

An inserter that reaches two tiles each way.

### Map size

How many tiles the map has along each side: small, medium or large.

### Mixer

Takes ore of one base color and liquid of another and makes paste of the color they mix to.

### Name

What a player is called in an online game: typed on the Online game screen, shown in the lobby, on the scoreboard and on the result. A player who types none is shown as Player and their place in the lobby.

### Ore

What an ore field holds, one color to a field. Drills mine it.

### Pipe

Carries one color of liquid between pumps and machines.

### Pump

Draws liquid from the lake beside it into its pipe.

### Recipe

The shape every player is racing to make, the same for everyone in a game.

Not: target, goal

### Rejects

Items that reached the exit looking different from the recipe. They disappear.

### Reroll

Swaps the previewed recipe, and the map with it, for another.

### Room code

The code another player types, or opens as a link, to join an online game.

### Saved factory

A finished solo factory kept from the Finished screen, to open again and look at.

Not: save game, snapshot

### Settings

Volume, edge pan and the hotbar, kept between visits.

### Splitter

Shares the items of two belts between two belts.

### Stamper

The machine that stacks one piece on another. The bottom piece rides through it on a belt; an inserter drops the top piece into a hopper on either side, and the stack leaves on the belt.

Not: assembler

### Tutorial

A short solo game that says what to build next.

### Underground belt

A pair of belt ends that carries items under whatever lies between them.

### Underground pipe

A pair of pipe ends that carries liquid under whatever lies between them.

### What's New

What changed in each version of the game, newest first. The version number on the main menu opens it.
