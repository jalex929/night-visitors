/** Words for the morning: what you brought to show and tell, and how the class took it. */
import { KIND_ORDER, KINDS, type Kind } from "./config";

export interface HaulLine {
  kind: Kind;
  count: number;
  text: string;
}

/** One line per kind collected, biggest things first ("1 pickup truck", "3 chickens"). */
export function haulLines(collected: Record<Kind, number>): HaulLine[] {
  return [...KIND_ORDER]
    .reverse()
    .filter((k) => collected[k] > 0)
    .map((kind) => {
      const count = collected[kind];
      const spec = KINDS[kind];
      return { kind, count, text: `${count} ${count === 1 ? spec.singular : spec.plural}` };
    });
}

/** "3 chickens, 1 hay bale and 1 very confused cow" (smallest first reads better aloud). */
export function haulSentence(collected: Record<Kind, number>): string {
  const parts = haulLines(collected)
    .reverse()
    .map((l) => l.text);
  if (parts.length === 0) return "nothing at all";
  if (parts.length === 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * How the class takes it, by score. Each range has one line per night, so the farm, town and
 * city mornings never repeat a line within a run.
 */
const REACTIONS: { below: number; lines: [string, string, string] }[] = [
  {
    below: 1,
    lines: [
      "You told a very long story about the moon instead.",
      "You showed everyone a nice rock you found. It went fine.",
      "You described the city lights in great detail. Someone clapped.",
    ],
  },
  {
    below: 100,
    lines: [
      "A solid start. The class wants to see more.",
      "A few kids asked good questions.",
      'Your teacher wrote "promising" on a sticky note.',
    ],
  },
  {
    below: 300,
    lines: [
      "The whole class leaned in.",
      'Someone in the back said "whoa" out loud.',
      "Even the class hamster looked impressed.",
    ],
  },
  {
    below: 600,
    lines: [
      "The teacher asked if they could keep one.",
      "Recess got pushed back so everyone could look closer.",
      "The principal came by to see what the fuss was about.",
    ],
  },
  {
    below: 1000,
    lines: [
      "Best show and tell in years.",
      "The class gave you a standing ovation.",
      "They're putting your photo on the hallway wall.",
    ],
  },
  {
    below: Infinity,
    lines: [
      "Nobody will ever top this. Ever.",
      "The whole school wants a turn next week.",
      "The local news wants an interview.",
    ],
  },
];

export function classReaction(score: number, night = 1): string {
  const band = REACTIONS.find((r) => score < r.below) ?? REACTIONS[REACTIONS.length - 1]!;
  return band.lines[(Math.max(1, night) - 1) % band.lines.length]!;
}
