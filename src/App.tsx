import { useEffect, useRef, useState } from "react";
import { MIN_NIGHT, WORLD_H, clampWorldWidth, headStart, locationForNight } from "./game/config";
import { newGame, step } from "./game/game";
import { classReaction, haulLines, haulSentence } from "./game/summary";
import { drawScene } from "./render/draw";
import { Game, reducedMotion, type NightResult } from "./ui/Game";
import { setSoundOn } from "./ui/sound";

/** The back link goes to the Lab page (relative when served from jayfox.design/lab/). */
const LAB_URL =
  typeof location !== "undefined" && location.pathname.includes("/lab/")
    ? "../"
    : "https://jayfox.design/lab";

/** `?night=20` makes a shorter night (handy for testing and quick demos). Never under 15 s. */
function nightLength(): number | undefined {
  if (typeof location === "undefined") return undefined;
  const raw = new URLSearchParams(location.search).get("night");
  const n = Number(raw);
  if (raw === null || !Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(600, Math.max(MIN_NIGHT, n));
}

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; the game works without it.
  }
}

/**
 * A run of nights. Each place starts the laser back at level 1; the level you reached buys a
 * head start on the next night, and the points add up.
 */
interface Run {
  night: number;
  headStart: number;
  total: number;
}

const NEW_RUN: Run = { night: 1, headStart: 0, total: 0 };

type Screen =
  | { name: "title" }
  | { name: "night"; key: number }
  | { name: "morning"; result: NightResult; best: boolean };

/** A quiet scene drawn behind the title and morning screens. */
function Backdrop({ night, morning }: { night: number; morning: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const state = newGame({ width: 960, seed: 5, duration: 100, night });
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const rect = canvas.getBoundingClientRect();
      const world = clampWorldWidth(rect.width / Math.max(1, rect.height));
      state.width = world;
      const t = now / 1000;
      const reduce = reducedMotion();
      state.saucerX = reduce ? world * 0.72 : world * (0.5 + 0.3 * Math.sin(t * 0.25));
      state.time = 0;
      step(state, { move: 0, targetX: null, beam: false }, dt);
      // The morning screen sits under a sunrise sky.
      state.time = morning ? 99.9 : 0;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.round(rect.width * dpr);
      const ph = Math.round(rect.height * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      const scale = pw / world;
      const top = Math.min(0, WORLD_H - ph / scale);
      ctx.setTransform(scale, 0, 0, scale, 0, -top * scale);
      drawScene(ctx, state, { clock: t, reducedMotion: reduce, floats: [], top });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [night, morning]);
  return <canvas ref={ref} className="backdrop" aria-hidden="true" />;
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "title" });
  const [run, setRun] = useState<Run>(NEW_RUN);
  const [sound, setSound] = useState(() => load("nv-sound") === "on");
  const [best, setBest] = useState(() => Number(load("nv-best")) || 0);

  useEffect(() => {
    setSoundOn(sound);
  }, [sound]);

  const toggleSound = () => {
    setSound((on) => {
      save("nv-sound", on ? "off" : "on");
      return !on;
    });
  };

  const startRun = () => {
    setRun(NEW_RUN);
    setScreen({ name: "night", key: Date.now() });
  };

  const nextNight = () => setScreen({ name: "night", key: Date.now() });

  const end = (result: NightResult) => {
    const isBest = result.score > best;
    if (isBest) {
      setBest(result.score);
      save("nv-best", String(result.score));
    }
    // Each new place starts the beam back at strength 1; only the points add up.
    setRun((r) => ({
      night: result.night + 1,
      headStart: headStart(result.level),
      total: r.total + result.score,
    }));
    setScreen({ name: "morning", result, best: isBest && result.score > 0 });
  };

  if (screen.name === "night") {
    return (
      <main className="app app-night">
        <Game
          key={screen.key}
          night={run.night}
          headStart={run.headStart}
          duration={nightLength()}
          sound={sound}
          onToggleSound={toggleSound}
          onEnd={end}
          onQuit={() => setScreen({ name: "title" })}
        />
      </main>
    );
  }

  const morning = screen.name === "morning";
  const played = morning ? locationForNight(screen.result.night) : null;
  const upNext = locationForNight(run.night);

  return (
    <main className="app app-menu">
      <Backdrop night={morning ? screen.result.night : 1} morning={morning} />
      <nav className="top">
        <a className="back" href={LAB_URL}>
          ← Lab
        </a>
        <button type="button" className="icon-button" aria-pressed={sound} onClick={toggleSound}>
          {sound ? "Sound on" : "Sound off"}
        </button>
      </nav>
      {!morning ? (
        <section className="panel" aria-labelledby="title">
          <p className="eyebrow">A tiny game from the Lab</p>
          <h1 id="title">Night Visitors</h1>
          <p className="tagline">Show and tell is in the morning.</p>
          <p className="lede">
            You're a young visitor out after dark, collecting things for class. Your beam lifts one
            thing at a time. Bigger things are worth more but take longer to lift, and everything
            else runs while you wait. Be home by sunrise.
          </p>
          <ul className="how">
            <li>
              <strong>Move</strong> with <kbd>←</kbd> <kbd>→</kbd>, the mouse, or drag a finger.
            </li>
            <li>
              <strong>Beam</strong> by holding <kbd>Space</kbd>, the mouse button, or the Beam
              button.
            </li>
            <li>
              <strong>Grow stronger</strong> as you collect: your beam gets wider and can lift
              heavier things. Things with a lock are too heavy for now.
            </li>
            <li>
              <strong>Three places:</strong> the farm, then town, then the city. Each one starts
              your laser back at level 1, and nights get shorter, but the level you reach earns a
              head start on the next.
            </li>
          </ul>
          <div className="actions">
            <button type="button" className="primary" onClick={startRun} autoFocus>
              Start the night
            </button>
          </div>
          {best > 0 && <p className="best">Best night so far: {best} points</p>}
        </section>
      ) : (
        <section className="panel" aria-labelledby="morning">
          <p className="eyebrow">
            Night {screen.result.night} · {played!.name} · Sunrise
          </p>
          <h1 id="morning" tabIndex={-1} ref={(el) => el?.focus()}>
            Home by morning
          </h1>
          <p className="lede">
            For show and tell, you brought <strong>{haulSentence(screen.result.collected)}</strong>.
          </p>
          <p className="score" data-testid="final-score">
            {screen.result.score} <span>points</span>
            {screen.best && <span className="badge">New best</span>}
          </p>
          <p className="reaction">{classReaction(screen.result.score)}</p>
          {haulLines(screen.result.collected).length > 0 && (
            <ul className="haul" aria-label="What you brought">
              {haulLines(screen.result.collected).map((l) => (
                <li key={l.kind}>{l.text}</li>
              ))}
            </ul>
          )}
          <p className="best">
            You reached laser level {screen.result.level}
            {run.headStart > 0
              ? `, so the night in ${upNext.place} gets a ${run.headStart}-second head start`
              : ""}
            . Total so far: {run.total} points.
          </p>
          <div className="actions">
            <button type="button" className="primary" onClick={nextNight}>
              Fly to {upNext.place}
            </button>
            <button type="button" onClick={() => setScreen({ name: "title" })}>
              Back to start
            </button>
          </div>
          {!screen.best && best > 0 && <p className="best">Best night so far: {best} points</p>}
        </section>
      )}
    </main>
  );
}
