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

export function classReaction(score: number): string {
  if (score === 0) return "You told a very long story about the moon instead.";
  if (score < 100) return "A solid start. The class wants to see more.";
  if (score < 300) return "The whole class leaned in.";
  if (score < 600) return "The teacher asked if they could keep one.";
  if (score < 1000) return "Best show and tell in years.";
  return "Nobody will ever top this. Ever.";
}
