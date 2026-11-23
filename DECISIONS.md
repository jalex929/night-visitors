# Decisions

How Night Visitors was set up on purpose: what was decided, why, and what was left out. Each
decision says who made it:

- **Jay's call:** a product or design decision Jay Fox made.
- **Proposed, approved:** suggested during the build and accepted by Jay.
- **Build default:** an engineering choice made while building it, kept because it worked.
  Open to change.

Night Visitors was designed by Jay Fox and built with an AI coding assistant (Claude) as a pair
programmer. Jay set the direction, played it in the browser while it was built, and made the
calls marked below.

## What it is for

A small, finished game for the Lab on [jayfox.design](https://jayfox.design/lab): game feel,
tuning and progression, readable feedback and accessible controls in a tiny package. A free,
non-commercial side project.

## Product decisions

**An original UFO growth game, lifting up instead of sinking down** (Jay's call). It's in the
same genre as growth games where you get bigger by swallowing things, but here a saucer beams
things up. The rule is an original name, art, characters and sounds.

**One thing at a time, and bigger takes longer** (Jay's call). That's the core choice: a quick
easy catch, or a slow big one while everything else runs away.

**2D side view first** (Jay's call). A 3/4 aerial town is a stretch goal.

**Named Night Visitors** (proposed, approved). The working name "Beam Me Up" is a well-known TV
line already used by other games. Jay wanted alien-themed and fun but not cheesy, and liked
"Night Visitors". Jay also liked the show-and-tell idea, so it became the story rather than the
title: "Show and tell is in the morning." Jay later confirmed the title stays Night Visitors
everywhere.

**Sunrise is the timer; the morning screen pays off the joke** (proposed, approved). The sky
lightens and the moon sets as time runs out, so no countdown needs explaining. At dawn you see
what you brought for show and tell and how the class took it.

**Three nights, then done: farm, town, city** (Jay's call, from a proposal). Jay asked that
"another night" go somewhere new, then decided a run is only the three. After the city, the card
shows the run total and Play again instead of looping back to the farm.

**A calmer morning card** (Jay asked for better spacing; layout proposed). The haul was listed
twice (a sentence and chips), so only the chips stay, under a "For show and tell" label. Points
and the class's reaction sit together; the laser level, head start and running total sit below
a divider, with room before the buttons. The heading is smaller so it fits on one line.

**Shorter nights, higher caps, and a head start you earn** (Jay's call; numbers proposed). Jay
first asked for 60-second nights, and decided against catches adding time. Then Jay set the
progression: the laser can level up 3 times on the farm, 4 in town and 5 in the city, each place
starts back at level 1, nights shrink by 15 seconds per place (60, 45, 30), and the level you
reached earns time on the next night. The rate of 5 seconds per level above 1 was proposed and
is easy to tune in `config.ts`.

**Big things only arrive after the first level-up, from off screen** (Jay's call). Large
vehicles (tractor, pickup, a combine harvester Jay asked for, car, food truck, taxi, night bus)
appear once medium things can be lifted. They drive in from off screen 0.5 to 4 seconds after
the level-up, never popping into the middle of the map. A "New!" tag and an announcement make
the arrival noticeable.

**"Laser leveled up!"** (Jay's call), shown as a message that pops in with a bounce (Jay's call),
with no animation under reduced motion. The beam visibly widens each level (Jay asked to see it
grow).

**Characters** (Jay's calls): cows are girl cows (udders, no horns, no eyelashes); the jogger
actually jogs; a slower walker was added (a pizza delivery person); city commuters vary in skin
tone and hair (short, bun, curls, ponytail); pigeons have beaks; raccoons kept their
original simple round shape with ears added, after a more detailed version looked scary.

**People are diverse** (Jay's call). Seven skin tones are shared by everyone in the game. Farmers
include women (a braid under the straw hat), and some commuters wear suits with a shirt and tie.

**A quiet song for each place** (Jay's call; the tunes are build defaults). Short loops written
as note lists and synthesized in the browser, so there are no audio files to license: a plucked
pentatonic tune for the farm, slow lo-fi chords for town, and a walking bass with soft hi-hats for
the city. They're kept well under the sound effects and follow the Sound button (off by default).

**Saucer lights follow the rim** (Jay's call). They travel around the disc, bigger and brighter
in front and dim at the back, so the saucer reads as round, not flat.

## Build defaults

- **Plain-data game state and a `step` function**, with seeded randomness, so the rules are unit
  tested without a browser and a night can be replayed exactly.
- **All art drawn in code** on a 2D canvas: no image files to license, tiny download.
- **World 540 units tall, width follows the screen** (480 to 1280). Tall screens show extra sky
  rather than empty space under the game.
- **Frame time clamped to 0 to 0.05 seconds.** A browser frame can report a time from before
  the game started, which once ran the clock backwards; slow devices play slightly slower rather
  than skipping.
- **Long things start further off screen**, so a bus isn't removed the moment it spawns (found
  by a test).
- **Touch uses a Beam button.** Dragging steers without scaring everything, which pressing the
  canvas to beam would do.
- **Synthesized sound, off by default.**
- **Things that are still too heavy carry a lock**, and anything new carries a "New!" tag:
  state shown by shape and text, not color alone.

## Left out on purpose

- Accounts and online scores: the best night is kept in the browser only.
- Upgrades between nights, combos and a 3/4 aerial view: noted as stretch ideas.

## Honest limits

- Checked by eye in desktop Chrome and with Playwright's Pixel 7 emulation; not yet played on
  real phones, Safari or Firefox.
- Sound is untested by automation.
- Point values, lift times and level thresholds are first guesses, tuned only by short play.
