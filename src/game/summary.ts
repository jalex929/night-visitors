/** Words for the morning: what you brought to show and tell, and how the class took it. */
import { KIND_ORDER, KINDS, type Kind, type LocationId } from "./config";

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
 * How the class takes it. Each place has its own score thresholds (nights get shorter and the
 * things to catch change) and its own lines, so no two mornings in a run read the same.
 * `below` is exclusive: a score lands in the first range it's under. Tune the numbers here.
 */
const REACTIONS: Record<LocationId, { below: number; line: string }[]> = {
  farm: [
    { below: 1, line: "You told a very long story about the moon instead." },
    { below: 60, line: "A solid start. The class wants to see more." },
    { below: 150, line: "The whole class leaned in." },
    { below: 300, line: "The teacher asked if they could keep a chicken." },
    { below: 500, line: "Best show and tell in years." },
    { below: Infinity, line: "Nobody will ever top this. Ever." },
  ],
  town: [
    { below: 1, line: "You showed everyone a nice rock you found. It went fine." },
    { below: 60, line: "A few kids asked good questions." },
    { below: 150, line: 'Someone in the back said "whoa" out loud.' },
    { below: 280, line: "Recess got pushed back so everyone could look closer." },
    { below: 450, line: "The class gave you a standing ovation." },
    { below: Infinity, line: "The whole school wants a turn next week." },
  ],
  city: [
    { below: 1, line: "You described the city lights in great detail. Someone clapped." },
    { below: 50, line: 'Your teacher wrote "promising" on a sticky note.' },
    { below: 120, line: "Even the class hamster looked impressed." },
    { below: 250, line: "The principal came by to see what the fuss was about." },
    { below: 400, line: "They're putting your photo on the hallway wall." },
    { below: Infinity, line: "The local news wants an interview." },
  ],
};

export function classReaction(score: number, place: LocationId = "farm"): string {
  const ranges = REACTIONS[place];
  return (ranges.find((r) => score < r.below) ?? ranges[ranges.length - 1]!).line;
}

/** Every reaction line, for checking there are no repeats. */
export const ALL_REACTIONS = Object.values(REACTIONS).flatMap((ranges) =>
  ranges.map((r) => r.line),
);
