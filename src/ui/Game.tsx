import { useCallback, useEffect, useRef, useState } from "react";
import { KINDS, STRENGTH_XP, WORLD_H, clampWorldWidth, type Kind } from "../game/config";
import { newGame, nextLevelXp, step, type GameState, type Input } from "../game/game";
import { drawScene, type FloatText } from "../render/draw";
import { play, setHum } from "./sound";

export interface NightResult {
  night: number;
  score: number;
  collected: Record<Kind, number>;
  /** Beam strength at sunrise, carried into the next night. */
  level: number;
  xp: number;
}

/** "cows, hay bales and picnic tables": what a new strength level lets you lift here. */
function unlocks(state: GameState, level: number): string {
  const names = state.location.kinds
    .filter((k) => KINDS[k].tier === level)
    .map((k) => KINDS[k].plural.replace(/^(very |fluffy |late-night |sleepy )/, ""));
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

interface Hud {
  score: number;
  level: number;
  xp: number;
  secondsLeft: number;
}

export function reducedMotion(): boolean {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function formatTime(s: number): string {
  const whole = Math.ceil(s);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Fits the world to the box it's drawn in: world width follows the box's shape. */
function useWorldSize(box: React.RefObject<HTMLDivElement>) {
  const [size, setSize] = useState({ world: 960, cssW: 960, cssH: 540 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = Math.max(200, el.clientHeight);
      const world = clampWorldWidth(w / h);
      let cssW = w;
      let cssH = (w * WORLD_H) / world;
      if (cssH > h) {
        cssH = h;
        cssW = (h * world) / WORLD_H;
      } else if (cssH < h) {
        // Tall screens (phones held upright) show extra sky instead of empty space.
        cssH = h;
      }
      setSize({ world, cssW, cssH });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [box]);
  return size;
}

interface Props {
  night: number;
  /** Seconds added to the night for the level reached in the place before. */
  headStart: number;
  duration?: number;
  sound: boolean;
  onToggleSound: () => void;
  onEnd: (result: NightResult) => void;
  onQuit: () => void;
}

export function Game({ night, headStart, duration, sound, onToggleSound, onEnd, onQuit }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useWorldSize(boxRef);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const stateRef = useRef<GameState | null>(null);
  if (!stateRef.current) {
    stateRef.current = newGame({
      width: size.world,
      duration,
      night,
      headStart,
    });
  }
  const place = stateRef.current.location;
  if (import.meta.env.DEV)
    (window as unknown as { __nv?: unknown }).__nv = { state: stateRef.current };
  const keys = useRef({ left: false, right: false, beam: false });
  const pointer = useRef<{ targetX: number | null; beam: boolean; button: boolean }>({
    targetX: null,
    beam: false,
    button: false,
  });
  const floats = useRef<FloatText[]>([]);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const [hud, setHud] = useState<Hud>({
    score: 0,
    level: 1,
    xp: 0,
    secondsLeft: stateRef.current.duration,
  });
  const [caption, setCaption] = useState("");
  const [toast, setToast] = useState<{ text: string; pop: boolean } | null>(null);
  const ended = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  // The world gets wider or narrower with the window; things just walk into the new space.
  useEffect(() => {
    const s = stateRef.current!;
    s.width = size.world;
    s.saucerX = Math.min(s.saucerX, size.world - 40);
  }, [size.world]);

  const showToast = useCallback((text: string, style?: "pop") => {
    setToast({ text, pop: style === "pop" });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 2800);
  }, []);

  // Game loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const state = stateRef.current!;
      const reduce = reducedMotion();
      if (!pausedRef.current) {
        const k = keys.current;
        const p = pointer.current;
        const input: Input = {
          move: k.left === k.right ? 0 : k.left ? -1 : 1,
          targetX: p.targetX,
          beam: k.beam || p.beam || p.button,
        };
        step(state, input, dt);
        setHum(state.beamOn);
        for (const ev of state.events) {
          if (ev.type === "collect") {
            play(`collect-${KINDS[ev.kind].tier}` as const);
            floats.current.push({
              x: ev.x,
              y: ev.y - 62,
              text: `+${ev.value}`,
              age: 0,
            });
            setCaption(`Got a ${KINDS[ev.kind].singular}. +${ev.value} points.`);
          } else if (ev.type === "lock") {
            play(ev.heavy ? "heavy" : "lock");
            if (ev.heavy) setCaption(`The ${KINDS[ev.kind].singular} is too heavy for now.`);
          } else if (ev.type === "drop") {
            play("drop");
            setCaption(`Dropped the ${KINDS[ev.kind].singular}.`);
          } else if (ev.type === "levelup") {
            play("levelup");
            const lifts = unlocks(state, ev.level);
            const msg = lifts
              ? `Laser leveled up! Now you can lift ${lifts}.`
              : "Laser leveled up!";
            showToast(msg, "pop");
            setCaption(msg);
          } else if (ev.type === "arrive") {
            const msg = `Just arrived: a ${KINDS[ev.kind].singular}!`;
            showToast(msg);
            setCaption(msg);
          } else if (ev.type === "dawn-soon") {
            play("dawn");
            showToast("The sun's coming up!");
            setCaption("The sun's coming up. 15 seconds left.");
          } else if (ev.type === "over") {
            setHum(false);
            setCaption("Morning. Time to go home.");
            if (!ended.current) {
              ended.current = true;
              window.setTimeout(
                () =>
                  onEndRef.current({
                    night: state.night,
                    score: state.score,
                    collected: { ...state.collected },
                    level: state.level,
                    xp: state.xp,
                  }),
                1400,
              );
            }
          }
        }
        for (const f of floats.current) f.age += dt;
        floats.current = floats.current.filter((f) => f.age < 1.2);
      } else {
        setHum(false);
      }
      if (now - hudAt > 100) {
        hudAt = now;
        setHud({
          score: state.score,
          level: state.level,
          xp: state.xp,
          secondsLeft: Math.max(0, state.duration - state.time),
        });
      }
      if (ctx) {
        const { cssW, cssH, world } = sizeRef.current;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const pw = Math.round(cssW * dpr);
        const ph = Math.round(cssH * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }
        const scale = pw / world;
        const top = Math.min(0, WORLD_H - ph / scale);
        ctx.setTransform(scale, 0, 0, scale, 0, -top * scale);
        drawScene(ctx, state, {
          clock: now / 1000,
          reducedMotion: reduce,
          floats: floats.current,
          top,
        });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      setHum(false);
    };
  }, [showToast]);

  // Keyboard.
  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      const k = keys.current;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("button:not(.beam-button), a") && (e.key === " " || e.key === "Enter")) {
        return;
      }
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          k.left = down;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          k.right = down;
          break;
        case " ":
        case "ArrowDown":
        case "s":
        case "S":
          k.beam = down;
          break;
        case "p":
        case "P":
        case "Escape":
          if (down && !e.repeat && !stateRef.current?.over) setPaused((v) => !v);
          return;
        default:
          return;
      }
      e.preventDefault();
      // Keys take over from the pointer until it moves again.
      if (down && e.key !== " " && e.key.toLowerCase() !== "s" && e.key !== "ArrowDown") {
        pointer.current.targetX = null;
      }
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    const blur = () => {
      keys.current = { left: false, right: false, beam: false };
      pointer.current.beam = false;
      pointer.current.button = false;
    };
    const hide = () => {
      if (document.visibilityState === "hidden" && !stateRef.current?.over) setPaused(true);
      blur();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);

  // Pointer: a mouse steers by hovering and beams while pressed; a finger drags to steer and
  // uses the Beam button to beam (so moving doesn't scare everything away).
  const worldX = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * sizeRef.current.world;
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer.current.targetX = worldX(e);
    if (e.pointerType === "mouse") pointer.current.beam = true;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" || e.buttons > 0) pointer.current.targetX = worldX(e);
  };
  const onPointerUp = () => {
    pointer.current.beam = false;
  };
  const beamButton = (on: boolean) => () => {
    pointer.current.button = on;
  };

  const maxLevel = place.maxLevel;
  const next = nextLevelXp(hud.level, maxLevel);
  const prev = STRENGTH_XP[hud.level - 1] ?? 0;
  const meter = next === null ? 1 : (hud.xp - prev) / (next - prev);
  const total = stateRef.current.duration;
  const dawn = 1 - hud.secondsLeft / total;

  return (
    <div className="game">
      <header className="hud" aria-label="Night status">
        <div className="hud-item">
          <span className="hud-label">Night {night}</span>
          <span className="hud-value">{place.name}</span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Score</span>
          <span className="hud-value" data-testid="score">
            {hud.score}
          </span>
        </div>
        <div className="hud-item hud-strength">
          <span className="hud-label">
            Strength {hud.level}
            {hud.level >= maxLevel ? " (max)" : ` of ${maxLevel}`}
          </span>
          <span
            className="meter"
            role="progressbar"
            aria-label={next === null ? "Beam strength: full" : "Beam strength to next level"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(meter * 100)}
          >
            <span className="meter-fill" style={{ width: `${Math.round(meter * 100)}%` }} />
          </span>
        </div>
        <div className="hud-item">
          <span className="hud-label">Sunrise in</span>
          <span className="hud-value" data-testid="time">
            <span className="sun" style={{ ["--dawn" as string]: dawn }} aria-hidden="true" />
            {formatTime(hud.secondsLeft)}
          </span>
        </div>
        <div className="hud-actions">
          <button
            type="button"
            className="icon-button"
            aria-pressed={sound}
            onClick={onToggleSound}
          >
            {sound ? "Sound on" : "Sound off"}
          </button>
          <button type="button" className="icon-button" onClick={() => setPaused(true)}>
            Pause
          </button>
        </div>
      </header>

      <div className="stage" ref={boxRef}>
        <canvas
          ref={canvasRef}
          className="canvas"
          style={{ width: size.cssW, height: size.cssH }}
          role="img"
          aria-label={`${place.name} at night. Your saucer hovers overhead. Use the arrow keys to move and hold Space to beam.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
        {toast && (
          <p
            key={toast.text}
            className={toast.pop ? "toast toast-pop" : "toast"}
            aria-hidden="true"
          >
            {toast.text}
          </p>
        )}
        {paused && (
          <div className="overlay">
            <div className="card" role="dialog" aria-modal="true" aria-labelledby="paused-title">
              <h2 id="paused-title">Paused</h2>
              <p>The farm will wait for you.</p>
              <div className="actions">
                <button
                  type="button"
                  className="primary"
                  autoFocus
                  onClick={() => setPaused(false)}
                >
                  Keep going
                </button>
                <button type="button" onClick={onQuit}>
                  Quit to start
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="controls">
        <p className="hint">
          <kbd>←</kbd> <kbd>→</kbd> move, hold <kbd>Space</kbd> to beam, <kbd>P</kbd> pause. Mouse:
          point to move, press to beam.
        </p>
        <button
          type="button"
          className="beam-button"
          aria-label="Beam (hold)"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            beamButton(true)();
          }}
          onPointerUp={beamButton(false)}
          onPointerCancel={beamButton(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          Hold to beam
        </button>
      </div>

      <p className="sr-only" aria-live="polite" data-testid="caption">
        {caption}
      </p>
    </div>
  );
}
