/** Tuning numbers for the nights. Everything the game loop needs to know lives here. */

export type Kind =
  // Farm
  | "chicken"
  | "sheep"
  | "farmer"
  | "cow"
  | "hay"
  | "table"
  | "tractor"
  | "truck"
  | "combine"
  // Town
  | "cat"
  | "dog"
  | "jogger"
  | "pizza"
  | "bin"
  | "bench"
  | "mailbox"
  | "car"
  | "foodtruck"
  // City
  | "pigeon"
  | "raccoon"
  | "commuter"
  | "cart"
  | "taxi"
  | "bus";

export type Tier = 1 | 2 | 3;

export interface KindSpec {
  tier: Tier;
  /** Points (and beam strength gained) for bringing it home. */
  value: number;
  /** Seconds of steady beaming to lift it all the way up. */
  liftTime: number;
  /** Ambling speed in world px/s (0 = stays put). */
  walk: number;
  /** Speed when scared by the beam. Things that don't flee keep `walk`. */
  run: number;
  flees: boolean;
  /** Drives (or is pushed) straight across instead of wandering. */
  drives: boolean;
  width: number;
  height: number;
  /** How many of these a place tries to keep around. */
  population: number;
  /** Seconds before a replacement turns up. */
  respawn: number;
  singular: string;
  plural: string;
}

type Shape = Omit<KindSpec, "run" | "flees" | "drives"> & Partial<KindSpec>;

const animal = (s: Shape): KindSpec => ({ run: s.walk * 4, flees: true, drives: false, ...s });
const thing = (s: Omit<Shape, "walk">): KindSpec => ({
  walk: 0,
  run: 0,
  flees: false,
  drives: false,
  ...s,
});
const vehicle = (s: Shape): KindSpec => ({ run: s.walk, flees: false, drives: true, ...s });

// Kept as a compact table on purpose, so the numbers are easy to compare and tune.
// prettier-ignore
export const KINDS: Record<Kind, KindSpec> = {
  // --- Farm ---
  chicken: animal({
    tier: 1, value: 10, liftTime: 0.6, walk: 34, run: 150, width: 22, height: 22,
    population: 4, respawn: 2.5, singular: "chicken", plural: "chickens",
  }),
  sheep: animal({
    tier: 1, value: 15, liftTime: 0.8, walk: 24, run: 105, width: 36, height: 28,
    population: 2, respawn: 4, singular: "fluffy sheep", plural: "fluffy sheep",
  }),
  farmer: animal({
    tier: 1, value: 20, liftTime: 0.9, walk: 30, run: 125, width: 20, height: 44,
    population: 2, respawn: 5, singular: "surprised farmer", plural: "surprised farmers",
  }),
  cow: animal({
    tier: 2, value: 40, liftTime: 1.6, walk: 18, run: 70, width: 58, height: 40,
    population: 2, respawn: 6, singular: "very confused cow", plural: "very confused cows",
  }),
  hay: thing({
    tier: 2, value: 30, liftTime: 1.3, width: 40, height: 32,
    population: 2, respawn: 5, singular: "hay bale", plural: "hay bales",
  }),
  table: thing({
    tier: 2, value: 35, liftTime: 1.5, width: 56, height: 26,
    population: 1, respawn: 7, singular: "picnic table", plural: "picnic tables",
  }),
  tractor: vehicle({
    tier: 3, value: 120, liftTime: 2.8, walk: 22, width: 74, height: 50,
    population: 1, respawn: 8, singular: "tractor", plural: "tractors",
  }),
  truck: vehicle({
    tier: 3, value: 150, liftTime: 3.2, walk: 70, width: 92, height: 46,
    population: 1, respawn: 9, singular: "pickup truck", plural: "pickup trucks",
  }),

  combine: vehicle({
    tier: 3, value: 220, liftTime: 3.8, walk: 16, width: 132, height: 72,
    population: 1, respawn: 12, singular: "combine harvester", plural: "combine harvesters",
  }),

  // --- Town ---
  cat: animal({
    tier: 1, value: 10, liftTime: 0.5, walk: 26, run: 165, width: 24, height: 22,
    population: 2, respawn: 3, singular: "unimpressed cat", plural: "unimpressed cats",
  }),
  dog: animal({
    tier: 1, value: 15, liftTime: 0.7, walk: 40, run: 150, width: 32, height: 26,
    population: 2, respawn: 4, singular: "very good dog", plural: "very good dogs",
  }),
  jogger: animal({
    tier: 1, value: 20, liftTime: 0.9, walk: 75, run: 135, width: 20, height: 44,
    population: 1, respawn: 5, singular: "late-night jogger", plural: "late-night joggers",
  }),
  pizza: animal({
    tier: 1, value: 15, liftTime: 0.8, walk: 32, run: 105, width: 24, height: 44,
    population: 1, respawn: 5, singular: "pizza delivery", plural: "pizza deliveries",
  }),
  bin: thing({
    tier: 2, value: 25, liftTime: 1.1, width: 26, height: 36,
    population: 2, respawn: 5, singular: "trash bin", plural: "trash bins",
  }),
  bench: thing({
    tier: 2, value: 35, liftTime: 1.4, width: 56, height: 28,
    population: 1, respawn: 6, singular: "park bench", plural: "park benches",
  }),
  mailbox: thing({
    tier: 2, value: 30, liftTime: 1.2, width: 24, height: 44,
    population: 1, respawn: 6, singular: "mailbox", plural: "mailboxes",
  }),
  car: vehicle({
    tier: 3, value: 120, liftTime: 2.6, walk: 105, width: 84, height: 38,
    population: 1, respawn: 6, singular: "family car", plural: "family cars",
  }),
  foodtruck: vehicle({
    tier: 3, value: 170, liftTime: 3.4, walk: 50, width: 104, height: 62,
    population: 1, respawn: 10, singular: "food truck", plural: "food trucks",
  }),

  // --- City ---
  pigeon: animal({
    tier: 1, value: 8, liftTime: 0.4, walk: 20, run: 175, width: 18, height: 16,
    population: 4, respawn: 2, singular: "pigeon", plural: "pigeons",
  }),
  raccoon: animal({
    tier: 1, value: 15, liftTime: 0.6, walk: 30, run: 140, width: 30, height: 22,
    population: 2, respawn: 4, singular: "suspicious raccoon", plural: "suspicious raccoons",
  }),
  commuter: animal({
    tier: 1, value: 20, liftTime: 0.9, walk: 50, run: 120, width: 20, height: 46,
    population: 3, respawn: 3, singular: "sleepy commuter", plural: "sleepy commuters",
  }),
  cart: vehicle({
    tier: 2, value: 45, liftTime: 1.6, walk: 14, width: 52, height: 48,
    population: 1, respawn: 7, singular: "hot dog cart", plural: "hot dog carts",
  }),
  taxi: vehicle({
    tier: 3, value: 130, liftTime: 2.6, walk: 125, width: 84, height: 40,
    population: 1, respawn: 5, singular: "taxi", plural: "taxis",
  }),
  bus: vehicle({
    tier: 3, value: 220, liftTime: 4, walk: 55, width: 150, height: 62,
    population: 1, respawn: 12, singular: "night bus", plural: "night buses",
  }),
};

export type LocationId = "farm" | "town" | "city";

export interface Location {
  id: LocationId;
  /** Highest laser level you can reach here. */
  maxLevel: number;
  /** Length of a night here before any head start, in seconds. */
  baseSeconds: number;
  /** "the farm", for sentences. */
  place: string;
  name: string;
  kinds: Kind[];
}

export const LOCATIONS: Location[] = [
  {
    id: "farm",
    maxLevel: 3,
    baseSeconds: 60,
    name: "Farm",
    place: "the farm",
    kinds: ["chicken", "sheep", "farmer", "cow", "hay", "table", "tractor", "truck", "combine"],
  },
  {
    id: "town",
    maxLevel: 4,
    baseSeconds: 45,
    name: "Town",
    place: "town",
    kinds: ["cat", "dog", "jogger", "pizza", "bin", "bench", "mailbox", "car", "foodtruck"],
  },
  {
    id: "city",
    maxLevel: 5,
    baseSeconds: 30,
    name: "City",
    place: "the city",
    kinds: ["pigeon", "raccoon", "commuter", "bin", "bench", "cart", "taxi", "bus"],
  },
];

/** A run is three nights: the farm, the town, then the city. */
export const NIGHTS = 3;

/** Night 1 is the farm, 2 the town, 3 the city. */
export function locationForNight(night: number): Location {
  return LOCATIONS[(Math.max(1, night) - 1) % LOCATIONS.length]!;
}

/** Every kind, smallest tier first, for counting and listing. */
export const KIND_ORDER: Kind[] = (Object.keys(KINDS) as Kind[]).sort(
  (a, b) => KINDS[a].tier - KINDS[b].tier,
);

/**
 * Big things only turn up once the beam can lift medium ones: a thing appears when the beam is
 * at most one level short of lifting it.
 */
export function appearsAt(kind: Kind): number {
  return Math.max(1, KINDS[kind].tier - 1);
}

/** Total points needed to reach laser level 1, 2, 3, 4 and 5 (each place caps it). */
export const STRENGTH_XP = [0, 60, 260, 520, 860] as const;

/** Seconds of head start per level reached above 1 in the place before. */
export const HEAD_START_PER_LEVEL = 5;

/** Head start for the next place, from the laser level reached in the last one. */
export function headStart(levelReached: number): number {
  return Math.max(0, levelReached - 1) * HEAD_START_PER_LEVEL;
}

/** Lifting gets quicker the more your laser outclasses a thing (10% per level above its tier). */
export function liftSeconds(kind: Kind, level: number): number {
  const spec = KINDS[kind];
  return spec.liftTime / (1 + 0.1 * Math.max(0, level - spec.tier));
}

/** Default night length when no place-specific length applies. */
export const ROUND_SECONDS = 60;
/** Shortest night allowed (the ?night= test link can't go below this). */
export const MIN_NIGHT = 15;
/** "The sun's coming up" warning, in seconds before the end. */
export const DAWN_WARNING = 10;

/** The world is always this tall; its width follows the screen (see clampWorldWidth). */
export const WORLD_H = 540;
export const GROUND_Y = 470;
export const SAUCER_Y = 118;
/** Where a lifted thing disappears into the saucer. */
export const HATCH_Y = SAUCER_Y + 26;

export const SAUCER_SPEED = 380;
/** Saucer speed multiplier while carrying something of each tier. */
export const CARRY_SLOWDOWN: Record<Tier, number> = { 1: 0.8, 2: 0.65, 3: 0.5 };
/** How fast the beam pulls a lifted thing toward its center (px/s). */
export const BEAM_PULL = 150;
export const GRAVITY = 1100;

export function clampWorldWidth(aspect: number): number {
  return Math.round(Math.min(1280, Math.max(480, WORLD_H * aspect)));
}

/** Half the beam's width at height y. It narrows toward the saucer and widens with strength. */
export function beamHalfWidth(y: number, level: number): number {
  const top = HATCH_Y - 8;
  const topHalf = 10 + 4 * level;
  const groundHalf = 38 + 18 * level;
  const t = Math.min(1, Math.max(0, (y - top) / (GROUND_Y - top)));
  return topHalf + (groundHalf - topHalf) * t;
}
