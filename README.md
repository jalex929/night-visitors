# Night Visitors

_Show and tell is in the morning._

A small browser game. You're a young visitor out after dark with a tractor-beam saucer,
collecting things for class before the sun comes up. The beam lifts one thing at a time:
bigger things are worth more but take longer to lift, and everything else runs while you wait.

## What it does

- **Three places, one after another:** the farm, then town, then the city (then round again).
  Each place starts the laser back at level 1, caps it higher (3, 4, then 5) and gives you a
  shorter night (60, 45, then 30 seconds). The level you reached earns a head start on the next
  night: 5 seconds for each level above 1.
- **One thing at a time.** Hold the beam over something and it rises; the bigger it is, the
  longer that takes. Let go or drift off and it drops. The saucer slows down while carrying.
- **Grow as you go.** Every catch adds to your laser level. Each level makes the beam wider and
  lifts heavier things. Things that are still too heavy wear a small lock and wobble in the beam
  ("Too heavy").
- **Big things arrive later.** Tractors, trucks, the combine harvester, cars, the food truck,
  taxis and the night bus only roll in once you can lift medium things. They drive in from off
  screen a moment after the level-up, with a "New!" tag and an announcement.
- **Sunrise is the timer.** The sky slowly lightens and the moon sets. A warning appears 10
  seconds before dawn.
- **The morning screen** lists what you brought for show and tell ("3 chickens, 1 very confused
  cow and 1 picnic table") and how the class took it.
- Controls: arrow keys or A/D to move and Space to beam; a mouse (point to move, press to beam);
  or a finger (drag to move, hold the Beam button). P or Escape pauses, and leaving the tab
  pauses too.
- Optional sound, synthesized in the browser with no audio files; off by default.
- Reduced motion: no star twinkle, rising rings, bobbing, chasing lights or wobble shake.

All art is drawn in code from simple shapes. There are no image files and nothing borrowed
from other games.

## How it's built

React 18, Vite and TypeScript, drawn on a `<canvas>`.

- `src/game/config.ts`: every tunable number in one place: what lives where, values, lift
  times, speeds, level thresholds, night lengths.
- `src/game/game.ts`: one night as plain data plus a `step(state, input, dt)` function. No
  DOM, seeded randomness, so tests can replay a night exactly.
- `src/game/summary.ts`: the morning's words.
- `src/render/draw.ts`: draws a state on a 2D canvas (sky, the three places, every character,
  the beam and the saucer).
- `src/ui/Game.tsx`: the game loop, input, HUD and captions. `src/App.tsx`: title, nights and
  mornings.

The world is 540 units tall; its width follows the screen (480 to 1280), and tall phone
screens show extra sky instead of empty space.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # types, lint, format, unit tests, build
npm run test:e2e   # Playwright, desktop Chrome + Pixel 7 (run npm run build first)
```

`?night=20` makes every night 20 seconds long (never under 15), which is handy for testing.
In development, `window.__nv.state` exposes the live game state.

## Tested

- Unit tests (Vitest) for the rules: lift times, one thing at a time, too-heavy things,
  dropping, drifting off, levelling up, level caps per place, night lengths and head starts,
  late arrivals from off screen, sunrise, fleeing, restocking, repeatability.
- Playwright: a short night from the title to the morning and on to town, and pause, on desktop
  Chrome and a Pixel 7 emulation.
- Not tested automatically: how it looks and feels (checked by eye in Chrome), sound, real
  touch devices, Safari and Firefox.

## License

MIT. See `LICENSE`.
