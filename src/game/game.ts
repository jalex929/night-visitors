/**
 * One night of Night Visitors as plain data plus a pure-ish step function (it mutates the state
 * it's given, and never touches the DOM). The UI feeds it input and draws whatever it returns.
 */
import {
  BEAM_PULL,
  CARRY_SLOWDOWN,
  DAWN_WARNING,
  GRAVITY,
  GROUND_Y,
  HATCH_Y,
  KIND_ORDER,
  KINDS,
  SAUCER_SPEED,
  STRENGTH_XP,
  appearsAt,
  beamHalfWidth,
  liftSeconds,
  locationForNight,
  type Kind,
  type Location,
} from "./config";

export type EntityState = "wander" | "flee" | "held" | "fall";

export interface Entity {
  id: number;
  kind: Kind;
  /** Center x and feet y, in world px. */
  x: number;
  y: number;
  vy: number;
  dir: 1 | -1;
  speed: number;
  state: EntityState;
  /** Seconds until a wanderer picks a new direction or pause. */
  timer: number;
  /** 0..1 fade-in when it first appears. */
  fade: number;
  /** Seconds left of the "just arrived" glow. */
  glow: number;
  /** 0..1 how far up the beam it is. */
  lift: number;
  /** Seconds it has been pulled at while too heavy (drives the wobble). */
  strain: number;
}

export type GameEvent =
  | { type: "lock"; kind: Kind; heavy: boolean }
  | { type: "drop"; kind: Kind }
  | { type: "collect"; kind: Kind; value: number; x: number; y: number }
  | { type: "levelup"; level: number }
  | { type: "arrive"; kind: Kind }
  | { type: "dawn-soon" }
  | { type: "over" };

export interface Input {
  /** -1 left, 0 none, 1 right (keyboard). */
  move: -1 | 0 | 1;
  /** Steer toward this world x (pointer). Ignored while `move` is non-zero. */
  targetX: number | null;
  beam: boolean;
}

export interface GameState {
  /** 1 for the first night of a run; picks the place. */
  night: number;
  location: Location;
  width: number;
  duration: number;
  time: number;
  over: boolean;
  saucerX: number;
  saucerVx: number;
  beamOn: boolean;
  targetId: number | null;
  entities: Entity[];
  nextId: number;
  score: number;
  /** Strength points; same as score for now, kept separate so upgrades can spend score later. */
  xp: number;
  level: number;
  collected: Record<Kind, number>;
  spawnTimers: Record<Kind, number>;
  /** Kinds that have shown up this night (big things arrive later, with an announcement). */
  arrived: Kind[];
  /** Unlocked kinds still on their way in; their first appearance is announced. */
  debuts: Kind[];
  warned: boolean;
  seed: number;
  /** Events from the latest step, for sound, captions and effects. Cleared every step. */
  events: GameEvent[];
}

/** Small seeded random generator (mulberry32) so tests can replay a night exactly. */
export function random(state: GameState): number {
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function emptyCounts(value: number): Record<Kind, number> {
  return Object.fromEntries(KIND_ORDER.map((k) => [k, value])) as Record<Kind, number>;
}

export interface NewGameOptions {
  width: number;
  seed?: number;
  /** Night length; defaults to the place's base length plus `headStart`. */
  duration?: number;
  /** Extra seconds earned by the level reached in the place before. */
  headStart?: number;
  night?: number;
  /** Beam strength carried over from the night before. */
  level?: number;
  xp?: number;
  /** Start with no farm (tests place their own entities). */
  empty?: boolean;
}

export function newGame({
  width,
  seed = Date.now(),
  duration,
  headStart = 0,
  empty = false,
  night = 1,
  level = 1,
  xp = 0,
}: NewGameOptions): GameState {
  const location = locationForNight(night);
  const state: GameState = {
    night,
    location,
    width,
    duration: duration ?? location.baseSeconds + headStart,
    time: 0,
    over: false,
    saucerX: width / 2,
    saucerVx: 0,
    beamOn: false,
    targetId: null,
    entities: [],
    nextId: 1,
    score: 0,
    xp,
    level,
    collected: emptyCounts(0),
    spawnTimers: emptyCounts(0),
    arrived: [],
    debuts: [],
    warned: false,
    seed,
    events: [],
  };
  if (!empty) {
    for (const kind of state.location.kinds) {
      const spec = KINDS[kind];
      if (state.level < appearsAt(kind)) continue;
      state.arrived.push(kind);
      for (let i = 0; i < spec.population; i++) {
        // Drivers roll in from off screen; everything else starts somewhere in view.
        if (spec.drives) spawn(state, kind, "edge");
        else spawn(state, kind, "field").fade = 1;
      }
    }
  }
  return state;
}

/** Adds an entity. "edge" walks in from off screen, "field" appears in place. */
export function spawn(state: GameState, kind: Kind, where: "edge" | "field" | number): Entity {
  const spec = KINDS[kind];
  let x: number;
  let dir: 1 | -1 = random(state) < 0.5 ? -1 : 1;
  if (typeof where === "number") {
    x = where;
  } else if (where === "edge") {
    x = dir === 1 ? -spec.width : state.width + spec.width;
  } else {
    // Somewhere on the field, but not right under the saucer.
    const margin = 30 + spec.width / 2;
    x = margin + random(state) * (state.width - margin * 2);
    if (Math.abs(x - state.saucerX) < 120) {
      x = (x + state.width / 2) % (state.width - margin * 2);
      x = Math.max(margin, x);
    }
    dir = random(state) < 0.5 ? -1 : 1;
  }
  const entity: Entity = {
    id: state.nextId++,
    kind,
    x,
    y: GROUND_Y,
    vy: 0,
    dir,
    speed: spec.walk,
    state: "wander",
    timer: 2 + random(state) * 3,
    fade: where === "field" ? 0 : 1,
    glow: 0,
    lift: 0,
    strain: 0,
  };
  state.entities.push(entity);
  return entity;
}

/** Points needed for the next laser level, or null at this place's cap. */
export function nextLevelXp(level: number, maxLevel: number): number | null {
  return level >= maxLevel ? null : (STRENGTH_XP[level] ?? null);
}

/** 0 at dusk, 1 at sunrise. */
export function dawnProgress(state: GameState): number {
  return Math.min(1, state.time / state.duration);
}

function findTarget(state: GameState): Entity | null {
  const reach = beamHalfWidth(GROUND_Y, state.level);
  let best: Entity | null = null;
  let bestScore = Infinity;
  for (const e of state.entities) {
    if (e.state === "held" || e.state === "fall" || e.fade < 1) continue;
    const dx = Math.abs(e.x - state.saucerX);
    if (dx > reach + KINDS[e.kind].width * 0.25) continue;
    // Prefer something you can actually lift; a too-heavy thing only gets picked if it's alone.
    const heavy = KINDS[e.kind].tier > state.level;
    const score = dx + (heavy ? 10_000 : 0);
    if (score < bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

function release(state: GameState, e: Entity) {
  state.targetId = null;
  e.strain = 0;
  if (e.lift > 0.02) {
    e.state = "fall";
    e.vy = 0;
    state.events.push({ type: "drop", kind: e.kind });
  } else {
    e.lift = 0;
    e.y = GROUND_Y;
    e.state = KINDS[e.kind].flees ? "flee" : "wander";
  }
}

function collect(state: GameState, e: Entity) {
  const spec = KINDS[e.kind];
  state.targetId = null;
  state.entities = state.entities.filter((o) => o !== e);
  state.score += spec.value;
  state.xp += spec.value;
  state.collected[e.kind] += 1;
  state.events.push({ type: "collect", kind: e.kind, value: spec.value, x: e.x, y: e.y });
  let next = nextLevelXp(state.level, state.location.maxLevel);
  while (next !== null && state.xp >= next) {
    state.level += 1;
    state.events.push({ type: "levelup", level: state.level });
    next = nextLevelXp(state.level, state.location.maxLevel);
  }
}

function held(state: GameState): Entity | null {
  if (state.targetId === null) return null;
  return state.entities.find((e) => e.id === state.targetId) ?? null;
}

function updateSaucer(state: GameState, input: Input, dt: number) {
  const carried = held(state);
  const carriedTier = carried ? KINDS[carried.kind].tier : null;
  const liftingHeavy = carried !== null && carriedTier !== null && carriedTier > state.level;
  const max = SAUCER_SPEED * (carriedTier && !liftingHeavy ? CARRY_SLOWDOWN[carriedTier] : 1);
  let desired = 0;
  if (input.move !== 0) desired = input.move * max;
  else if (input.targetX !== null) {
    const dx = input.targetX - state.saucerX;
    desired = Math.max(-max, Math.min(max, dx * 7));
    if (Math.abs(dx) < 1.5) desired = 0;
  }
  state.saucerVx += (desired - state.saucerVx) * Math.min(1, dt * 9);
  state.saucerX += state.saucerVx * dt;
  const min = 40;
  if (state.saucerX < min || state.saucerX > state.width - min) {
    state.saucerX = Math.max(min, Math.min(state.width - min, state.saucerX));
    state.saucerVx = 0;
  }
}

function updateBeam(state: GameState, input: Input, dt: number) {
  state.beamOn = input.beam;
  let e = held(state);
  if (!input.beam) {
    if (e) release(state, e);
    return;
  }
  if (!e) {
    e = findTarget(state);
    if (!e) return;
    state.targetId = e.id;
    e.state = "held";
    e.strain = 0;
    state.events.push({ type: "lock", kind: e.kind, heavy: KINDS[e.kind].tier > state.level });
  }
  const spec = KINDS[e.kind];
  const tolerance = spec.width * 0.3;
  if (Math.abs(e.x - state.saucerX) > beamHalfWidth(e.y, state.level) + tolerance) {
    release(state, e);
    return;
  }
  if (spec.tier > state.level) {
    // Too heavy: it rocks in the beam but won't leave the ground.
    e.strain += dt;
    return;
  }
  // Pull it toward the middle of the beam while it rises.
  const dx = state.saucerX - e.x;
  const pull = Math.min(Math.abs(dx), BEAM_PULL * dt);
  e.x += Math.sign(dx) * pull;
  e.lift = Math.min(1, e.lift + dt / liftSeconds(e.kind, state.level));
  e.y = GROUND_Y - e.lift * (GROUND_Y - HATCH_Y);
  if (e.lift >= 1) collect(state, e);
}

function updateEntity(state: GameState, e: Entity, dt: number) {
  const spec = KINDS[e.kind];
  e.fade = Math.min(1, e.fade + dt * 2);
  e.glow = Math.max(0, e.glow - dt);
  if (e.state === "held") return;
  if (e.state === "fall") {
    e.vy += GRAVITY * dt;
    e.y += e.vy * dt;
    if (e.y >= GROUND_Y) {
      e.y = GROUND_Y;
      e.vy = 0;
      e.lift = 0;
      e.state = spec.flees ? "flee" : "wander";
      e.timer = 1.5;
    } else {
      e.lift = (GROUND_Y - e.y) / (GROUND_Y - HATCH_Y);
    }
    return;
  }

  if (spec.drives) {
    e.speed = spec.walk;
  } else if (spec.flees) {
    const near = Math.abs(e.x - state.saucerX) < beamHalfWidth(GROUND_Y, state.level) * 2.4;
    if (state.beamOn && near) {
      e.state = "flee";
      e.dir = e.x < state.saucerX ? -1 : 1;
      e.timer = 1.2 + random(state);
    }
    e.timer -= dt;
    if (e.state === "flee") {
      e.speed = spec.run;
      if (e.timer <= 0) {
        e.state = "wander";
        e.timer = 1 + random(state) * 2;
      }
    } else {
      if (e.timer <= 0) {
        // Amble, turn around or stop for a bit.
        const r = random(state);
        e.speed = r < 0.3 ? 0 : spec.walk * (0.6 + random(state) * 0.6);
        if (r > 0.65) e.dir = e.dir === 1 ? -1 : 1;
        e.timer = 1.5 + random(state) * 2.5;
      }
      // Wanderers turn back at the fences; only scared things run off the screen.
      if (e.x < 24) e.dir = 1;
      if (e.x > state.width - 24) e.dir = -1;
    }
  } else {
    e.speed = 0;
  }
  e.x += e.dir * e.speed * dt;
}

function updateSpawns(state: GameState, dt: number) {
  state.entities = state.entities.filter((e) => {
    // Long things (a bus) start further off screen, so the edge allowance scales with width.
    const margin = KINDS[e.kind].width + 60;
    const out = e.x < -margin || e.x > state.width + margin;
    return !(out && e.state !== "held");
  });
  for (const kind of state.location.kinds) {
    const spec = KINDS[kind];
    // Big things wait until the beam is nearly strong enough for them, then turn up in view.
    if (state.level < appearsAt(kind)) continue;
    if (!state.arrived.includes(kind)) {
      // Newly unlocked: it rolls in from off screen a moment later (0.5 to 4 seconds).
      state.arrived.push(kind);
      state.debuts.push(kind);
      state.spawnTimers[kind] = 0.5 + random(state) * 3.5;
      continue;
    }
    const count = state.entities.reduce((n, e) => n + (e.kind === kind ? 1 : 0), 0);
    if (count >= spec.population) {
      state.spawnTimers[kind] = spec.respawn;
      continue;
    }
    state.spawnTimers[kind] -= dt;
    if (state.spawnTimers[kind] <= 0) {
      const e = spawn(state, kind, spec.walk > 0 ? "edge" : "field");
      state.spawnTimers[kind] = spec.respawn;
      if (state.debuts.includes(kind)) {
        state.debuts = state.debuts.filter((k) => k !== kind);
        e.glow = 4;
        state.events.push({ type: "arrive", kind });
      }
    }
  }
}

/** Advances the night by dt seconds. Returns the same state (mutated). */
export function step(state: GameState, input: Input, dt: number): GameState {
  state.events = [];
  if (state.over) return state;
  dt = Math.max(0, Math.min(dt, 0.05));
  state.time += dt;
  if (!state.warned && state.duration - state.time <= DAWN_WARNING) {
    state.warned = true;
    state.events.push({ type: "dawn-soon" });
  }
  if (state.time >= state.duration) {
    state.time = state.duration;
    state.over = true;
    const e = held(state);
    if (e) release(state, e);
    state.beamOn = false;
    state.events.push({ type: "over" });
    return state;
  }
  updateSaucer(state, input, dt);
  updateBeam(state, input, dt);
  for (const e of state.entities) updateEntity(state, e, dt);
  updateSpawns(state, dt);
  return state;
}
