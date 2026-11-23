import { describe, expect, it } from "vitest";
import { GROUND_Y, KINDS, STRENGTH_XP, beamHalfWidth, headStart, locationForNight } from "./config";
import { newGame, spawn, step, type GameState, type Input } from "./game";
import { classReaction, haulSentence } from "./summary";

const idle: Input = { move: 0, targetX: null, beam: false };
const beam: Input = { move: 0, targetX: null, beam: true };

function run(state: GameState, input: Input, seconds: number) {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    step(state, input, 1 / 60);
    events.push(...state.events);
  }
  return events;
}

function emptyNight(): GameState {
  const state = newGame({ width: 960, seed: 7, empty: true });
  // No spawning during these tests unless a test asks for it.
  for (const k of Object.keys(state.spawnTimers)) state.spawnTimers[k as keyof typeof KINDS] = 1e9;
  return state;
}

/** Places a thing under the saucer that won't wander off on its own. */
function under(state: GameState, kind: keyof typeof KINDS) {
  const e = spawn(state, kind, state.saucerX);
  e.speed = 0;
  e.timer = 1e9;
  return e;
}

describe("lifting", () => {
  it("lifts a light thing in about its lift time and scores it", () => {
    const state = emptyNight();
    under(state, "chicken");
    const events = run(state, beam, KINDS.chicken.liftTime + 0.1);
    expect(events.some((e) => e.type === "collect" && e.kind === "chicken")).toBe(true);
    expect(state.score).toBe(KINDS.chicken.value);
    expect(state.collected.chicken).toBe(1);
    expect(state.entities).toHaveLength(0);
  });

  it("bigger things take longer: a cow is still rising when a chicken would be done", () => {
    const state = emptyNight();
    state.level = 2;
    const cow = under(state, "cow");
    run(state, beam, KINDS.chicken.liftTime + 0.1);
    expect(state.collected.cow).toBe(0);
    expect(cow.lift).toBeGreaterThan(0.3);
    expect(cow.lift).toBeLessThan(1);
  });

  it("holds one thing at a time", () => {
    const state = emptyNight();
    under(state, "chicken");
    under(state, "chicken");
    run(state, beam, 0.2);
    expect(state.entities.filter((e) => e.state === "held")).toHaveLength(1);
  });

  it("too-heavy things strain and wobble but never leave the ground", () => {
    const state = emptyNight();
    const cow = under(state, "cow");
    const events = run(state, beam, 3);
    expect(events).toContainEqual({ type: "lock", kind: "cow", heavy: true });
    expect(cow.y).toBe(GROUND_Y);
    expect(cow.strain).toBeGreaterThan(2);
    expect(state.score).toBe(0);
  });

  it("prefers something liftable over a heavier thing in the same beam", () => {
    const state = emptyNight();
    under(state, "cow");
    const chicken = spawn(state, "chicken", state.saucerX + 20);
    chicken.speed = 0;
    run(state, beam, 0.1);
    expect(state.targetId).toBe(chicken.id);
  });

  it("letting go drops a half-lifted thing back to the ground", () => {
    const state = emptyNight();
    const sheep = under(state, "sheep");
    run(state, beam, KINDS.sheep.liftTime / 2);
    expect(sheep.y).toBeLessThan(GROUND_Y);
    const events = run(state, idle, 1);
    expect(events).toContainEqual({ type: "drop", kind: "sheep" });
    expect(sheep.y).toBe(GROUND_Y);
    expect(state.collected.sheep).toBe(0);
  });

  it("drifting away from a lifted thing loses it", () => {
    const state = emptyNight();
    state.level = 2;
    const cow = under(state, "cow");
    run(state, beam, 0.6);
    const events = run(state, { move: 1, targetX: null, beam: true }, 1);
    expect(events).toContainEqual({ type: "drop", kind: "cow" });
    expect(state.collected.cow).toBe(0);
    expect(cow.state).not.toBe("held");
  });
});

describe("strength", () => {
  it("levels up when enough has been collected", () => {
    const state = emptyNight();
    const events = [];
    while (state.xp < (STRENGTH_XP[1] ?? 0)) {
      under(state, "farmer");
      events.push(...run(state, beam, KINDS.farmer.liftTime + 0.1));
    }
    expect(state.level).toBe(2);
    expect(events).toContainEqual({ type: "levelup", level: 2 });
  });
});

describe("the night", () => {
  it("warns before sunrise, then ends and stops scoring", () => {
    const state = newGame({ width: 960, seed: 3, duration: 20 });
    const events = run(state, idle, 21);
    expect(events.filter((e) => e.type === "dawn-soon")).toHaveLength(1);
    expect(events.filter((e) => e.type === "over")).toHaveLength(1);
    expect(state.over).toBe(true);
    under(state, "chicken");
    run(state, beam, 2);
    expect(state.score).toBe(0);
  });

  it("never runs the clock backwards (a browser frame can report a time before the start)", () => {
    const state = newGame({ width: 960, seed: 1 });
    step(state, idle, -0.4);
    expect(state.time).toBe(0);
  });

  it("animals run away from an active beam", () => {
    const state = emptyNight();
    const chicken = spawn(state, "chicken", state.saucerX + 90);
    run(state, beam, 0.1);
    expect(chicken.state).toBe("flee");
    expect(chicken.dir).toBe(1);
  });

  it("the farm restocks over time", () => {
    const state = newGame({ width: 960, seed: 11 });
    const start = state.entities.length;
    state.entities = state.entities.filter((e) => e.kind !== "chicken");
    run(state, idle, KINDS.chicken.respawn * 4 + 1);
    expect(state.entities.filter((e) => e.kind === "chicken").length).toBeGreaterThan(0);
    expect(state.entities.length).toBeLessThanOrEqual(start);
  });

  it("is repeatable with the same seed", () => {
    const a = newGame({ width: 960, seed: 42 });
    const b = newGame({ width: 960, seed: 42 });
    run(a, { move: 0, targetX: 300, beam: true }, 5);
    run(b, { move: 0, targetX: 300, beam: true }, 5);
    expect(a.score).toBe(b.score);
    expect(a.entities.map((e) => [e.kind, Math.round(e.x)])).toEqual(
      b.entities.map((e) => [e.kind, Math.round(e.x)]),
    );
  });
});

describe("more nights", () => {
  it("big things only turn up once the beam can lift medium ones", () => {
    for (const night of [1, 2, 3]) {
      const state = newGame({ width: 960, seed: night, night, duration: 1e6 });
      run(state, idle, 20);
      expect(state.entities.some((e) => KINDS[e.kind].tier === 3)).toBe(false);
      expect(state.entities.some((e) => KINDS[e.kind].tier === 2)).toBe(true);
      state.level = 2;
      run(state, idle, 15);
      expect(state.entities.some((e) => KINDS[e.kind].tier === 3)).toBe(true);
    }
  });

  it("new big things roll in from off screen 0.5 to 4 seconds after the level-up", () => {
    const state = newGame({ width: 960, seed: 9, night: 1, duration: 1e6 });
    state.level = 2;
    const arrivals: { t: number; x: number }[] = [];
    for (let t = 0; t < 6; t += 1 / 60) {
      step(state, idle, 1 / 60);
      for (const ev of state.events) {
        if (ev.type === "arrive") {
          const e = state.entities.find((o) => o.kind === ev.kind && o.glow > 0)!;
          arrivals.push({ t, x: e.x });
        }
      }
    }
    expect(arrivals.length).toBeGreaterThan(0);
    for (const a of arrivals) {
      expect(a.t).toBeGreaterThanOrEqual(0.45);
      expect(a.t).toBeLessThanOrEqual(4.1);
      expect(a.x < 0 || a.x > 960).toBe(true);
    }
  });

  it("each place caps the laser: 3 on the farm, 4 in town, 5 in the city", () => {
    for (const [night, cap] of [
      [1, 3],
      [2, 4],
      [3, 5],
    ] as const) {
      const state = newGame({ width: 960, night, empty: true, duration: 1e6 });
      state.xp = 5000;
      under(state, "chicken");
      run(state, beam, 1);
      expect(state.level).toBe(cap);
    }
  });

  it("nights get shorter, with a head start for the level reached before", () => {
    expect(newGame({ width: 960, night: 1 }).duration).toBe(60);
    expect(newGame({ width: 960, night: 2 }).duration).toBe(45);
    expect(newGame({ width: 960, night: 2, headStart: headStart(3) }).duration).toBe(55);
    expect(newGame({ width: 960, night: 3, headStart: headStart(4) }).duration).toBe(45);
  });

  it("catches don't change the length of the night", () => {
    const state = emptyNight();
    const start = state.duration;
    under(state, "chicken");
    run(state, beam, KINDS.chicken.liftTime + 0.1);
    expect(state.collected.chicken).toBe(1);
    expect(state.duration).toBe(start);
  });

  it("night 1 is the farm, 2 the town, 3 the city, then the farm again", () => {
    expect([1, 2, 3, 4].map((n) => locationForNight(n).id)).toEqual([
      "farm",
      "town",
      "city",
      "farm",
    ]);
  });

  it("each place only stocks its own things", () => {
    for (const night of [1, 2, 3]) {
      const state = newGame({ width: 960, seed: night, night });
      run(state, idle, 20);
      const allowed = new Set(state.location.kinds);
      expect(state.entities.every((e) => allowed.has(e.kind))).toBe(true);
    }
  });

  it("every new place starts the laser back at level 1", () => {
    const state = newGame({ width: 960, night: 2, headStart: headStart(3), empty: true });
    expect(state.level).toBe(1);
    expect(state.xp).toBe(0);
  });

  it("a stronger beam is wider", () => {
    expect(beamHalfWidth(GROUND_Y, 2)).toBeGreaterThan(beamHalfWidth(GROUND_Y, 1) + 10);
    expect(beamHalfWidth(GROUND_Y, 3)).toBeGreaterThan(beamHalfWidth(GROUND_Y, 2) + 10);
  });
});

describe("the morning", () => {
  it("lists the haul in a sentence", () => {
    const counts = { ...newGame({ width: 960, empty: true }).collected };
    expect(haulSentence(counts)).toBe("nothing at all");
    counts.chicken = 3;
    counts.table = 1;
    counts.cow = 1;
    expect(haulSentence(counts)).toBe("3 chickens, 1 very confused cow and 1 picnic table");
  });

  it("the class reacts more as the score grows", () => {
    expect(classReaction(0)).not.toBe(classReaction(50));
    expect(classReaction(50)).not.toBe(classReaction(2000));
  });

  it("never repeats a reaction across the three nights of a run", () => {
    for (const score of [0, 50, 200, 450, 800, 5000]) {
      const lines = [1, 2, 3].map((night) => classReaction(score, night));
      expect(new Set(lines).size).toBe(3);
    }
  });
});
