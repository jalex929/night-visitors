/**
 * Draws a night on a 2D canvas. Everything is drawn from shapes in code: no image files, and no
 * art from anywhere else. World units: WORLD_H tall, state.width wide, feet of things at y.
 */
import {
  GROUND_Y,
  HATCH_Y,
  KINDS,
  SAUCER_Y,
  WORLD_H,
  beamHalfWidth,
  type Kind,
} from "../game/config";
import { dawnProgress, type Entity, type GameState } from "../game/game";

export interface FloatText {
  x: number;
  y: number;
  text: string;
  age: number;
}

export interface View {
  /** Seconds since the page loaded, for idle animation. */
  clock: number;
  reducedMotion: boolean;
  floats: FloatText[];
  /** World y at the top of the canvas. Negative on tall screens, which show extra sky. */
  top?: number;
}

type RGB = [number, number, number];

function mix(a: RGB, b: RGB, t: number): string {
  const c = a.map((v, i) => Math.round(v + ((b[i] ?? v) - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function smooth(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** How far toward morning the colors are: stays night for most of the round. */
export function skyLight(state: GameState): number {
  return smooth((dawnProgress(state) - 0.45) / 0.55);
}

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
}

// Star positions are fixed for the page so they don't jump between frames.
const STARS = Array.from({ length: 90 }, (_, i) => {
  const r = (n: number) => {
    const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  return { x: r(1), y: r(2) * 0.62, size: 0.6 + r(3) * 1.4, phase: r(4) * 6.28 };
});

function drawSky(ctx: CanvasRenderingContext2D, state: GameState, view: View, light: number) {
  const w = state.width;
  const top = view.top ?? 0;
  const sky = ctx.createLinearGradient(0, top, 0, GROUND_Y);
  sky.addColorStop(0, mix([7, 9, 34], [74, 92, 160], light));
  sky.addColorStop(0.6, mix([20, 22, 66], [196, 150, 170], light));
  sky.addColorStop(1, mix([38, 36, 88], [255, 186, 140], light));
  ctx.fillStyle = sky;
  ctx.fillRect(0, top, w, WORLD_H - top);

  for (const s of STARS) {
    const twinkle = view.reducedMotion ? 0.8 : 0.55 + 0.45 * Math.sin(view.clock * 1.7 + s.phase);
    ctx.globalAlpha = (1 - light) * twinkle;
    ctx.fillStyle = "#f4f1ff";
    ctx.fillRect(s.x * w, top + s.y * (GROUND_Y - top), s.size, s.size);
  }
  ctx.globalAlpha = 1;

  // The moon sets as the night goes on.
  const p = dawnProgress(state);
  const mx = w * 0.16;
  const my = 70 + p * 120;
  ctx.globalAlpha = 1 - light * 0.7;
  ctx.fillStyle = "#f6f0d8";
  ellipse(ctx, mx, my, 22, 22);
  ctx.fill();
  ctx.fillStyle = mix([12, 14, 44], [110, 120, 170], light);
  ellipse(ctx, mx + 9, my - 5, 20, 20);
  ctx.fill();
  ctx.globalAlpha = 1;

  // The sun peeks over the hills at the very end.
  if (light > 0.01) {
    const sx = w * 0.78;
    const sy = GROUND_Y - 30 + (1 - light) * 70;
    const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 220);
    glow.addColorStop(0, `rgba(255,214,150,${0.7 * light})`);
    glow.addColorStop(1, "rgba(255,214,150,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, top, w, WORLD_H - top);
    ctx.fillStyle = `rgba(255,224,170,${light})`;
    ellipse(ctx, sx, sy, 34, 34);
    ctx.fill();
  }
}

function hill(
  ctx: CanvasRenderingContext2D,
  w: number,
  base: number,
  amp: number,
  freq: number,
  shift: number,
) {
  ctx.beginPath();
  ctx.moveTo(0, WORLD_H);
  for (let x = 0; x <= w + 20; x += 20) {
    const y =
      base - amp * (0.6 * Math.sin(x * freq + shift) + 0.4 * Math.sin(x * freq * 2.3 + shift * 2));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, WORLD_H);
  ctx.closePath();
  ctx.fill();
}

function drawFarm(ctx: CanvasRenderingContext2D, state: GameState, light: number) {
  const w = state.width;
  ctx.fillStyle = mix([22, 26, 64], [120, 110, 150], light);
  hill(ctx, w, GROUND_Y - 70, 26, 0.006, 1);
  ctx.fillStyle = mix([16, 24, 48], [82, 100, 96], light);
  hill(ctx, w, GROUND_Y - 34, 16, 0.009, 4);

  const sil = mix([10, 14, 32], [60, 64, 80], light);
  const lit = windowLight(light);
  // Farmhouse.
  const hx = w * 0.62;
  const hy = GROUND_Y - 40;
  ctx.fillStyle = sil;
  // Walls run all the way down behind the fence so nothing floats above the field.
  const floor = GROUND_Y - 6;
  ctx.fillRect(hx, hy - 34, 54, floor - (hy - 34));
  ctx.beginPath();
  ctx.moveTo(hx - 6, hy - 34);
  ctx.lineTo(hx + 27, hy - 56);
  ctx.lineTo(hx + 60, hy - 34);
  ctx.fill();
  ctx.fillRect(hx + 38, hy - 62, 7, 16);
  ctx.fillStyle = lit;
  ctx.fillRect(hx + 9, hy - 24, 9, 9);
  ctx.fillRect(hx + 34, hy - 24, 9, 9);
  // Barn and silo.
  const bx = w * 0.3;
  ctx.fillStyle = sil;
  ctx.beginPath();
  ctx.moveTo(bx, floor);
  ctx.lineTo(bx, hy - 38);
  ctx.lineTo(bx + 14, hy - 56);
  ctx.lineTo(bx + 46, hy - 56);
  ctx.lineTo(bx + 60, hy - 38);
  ctx.lineTo(bx + 60, floor);
  ctx.fill();
  rrect(ctx, bx + 66, hy - 70, 20, floor - (hy - 70), 10);
  ctx.fill();
  ctx.fillStyle = lit;
  ctx.fillRect(bx + 25, hy - 44, 10, 8);

  // Grass, and a fence along the back of the field.
  groundBand(
    ctx,
    w,
    mix([18, 38, 46], [74, 112, 70], light),
    mix([8, 18, 26], [40, 70, 46], light),
  );
  ctx.strokeStyle = mix([40, 52, 70], [120, 100, 80], light);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y - 22);
  ctx.lineTo(w, GROUND_Y - 22);
  ctx.moveTo(0, GROUND_Y - 13);
  ctx.lineTo(w, GROUND_Y - 13);
  for (let x = 8; x < w; x += 46) {
    ctx.moveTo(x, GROUND_Y - 6);
    ctx.lineTo(x, GROUND_Y - 28);
  }
  ctx.stroke();
}

function windowLight(light: number): string {
  return `rgba(255,206,120,${0.95 - light * 0.8})`;
}

function groundBand(ctx: CanvasRenderingContext2D, w: number, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, GROUND_Y - 10, 0, WORLD_H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND_Y - 6, w, WORLD_H - GROUND_Y + 6);
}

/** Fixed pseudo-random numbers so buildings don't change shape between frames. */
function hash(n: number): number {
  const s = Math.sin(n * 91.3458) * 47453.5453;
  return s - Math.floor(s);
}

function streetLamp(ctx: CanvasRenderingContext2D, x: number, light: number, pole: string) {
  ctx.strokeStyle = pole;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, GROUND_Y - 4);
  ctx.lineTo(x, GROUND_Y - 92);
  ctx.quadraticCurveTo(x, GROUND_Y - 100, x + 10, GROUND_Y - 100);
  ctx.stroke();
  const on = 1 - light * 0.9;
  const glow = ctx.createRadialGradient(x + 12, GROUND_Y - 96, 2, x + 12, GROUND_Y - 60, 70);
  glow.addColorStop(0, `rgba(255,214,140,${0.35 * on})`);
  glow.addColorStop(1, "rgba(255,214,140,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.moveTo(x + 6, GROUND_Y - 96);
  ctx.lineTo(x + 18, GROUND_Y - 96);
  ctx.lineTo(x + 50, GROUND_Y);
  ctx.lineTo(x - 26, GROUND_Y);
  ctx.fill();
  ctx.fillStyle = `rgba(255,226,160,${0.4 + 0.6 * on})`;
  ellipse(ctx, x + 12, GROUND_Y - 97, 5, 3);
  ctx.fill();
}

function drawTown(ctx: CanvasRenderingContext2D, state: GameState, light: number) {
  const w = state.width;
  ctx.fillStyle = mix([22, 26, 64], [120, 110, 150], light);
  hill(ctx, w, GROUND_Y - 60, 18, 0.005, 2);
  // A row of houses with gabled roofs, some windows still lit.
  const sil = mix([14, 16, 40], [70, 70, 92], light);
  const lit = windowLight(light);
  let x = 6;
  let i = 0;
  while (x < w) {
    const hw = 54 + hash(i) * 34;
    const hh = 40 + hash(i + 7) * 26;
    const base = GROUND_Y - 30;
    ctx.fillStyle = sil;
    ctx.fillRect(x, base - hh, hw, hh);
    ctx.beginPath();
    ctx.moveTo(x - 4, base - hh);
    ctx.lineTo(x + hw / 2, base - hh - 22);
    ctx.lineTo(x + hw + 4, base - hh);
    ctx.fill();
    ctx.fillStyle = lit;
    if (hash(i + 3) > 0.35) ctx.fillRect(x + 10, base - hh + 12, 10, 10);
    if (hash(i + 5) > 0.5) ctx.fillRect(x + hw - 20, base - hh + 12, 10, 10);
    x += hw + 14 + hash(i + 9) * 20;
    i++;
  }
  // Sidewalk, then the street in front.
  ctx.fillStyle = mix([36, 38, 62], [150, 146, 150], light);
  ctx.fillRect(0, GROUND_Y - 30, w, 26);
  groundBand(
    ctx,
    w,
    mix([28, 30, 46], [96, 98, 108], light),
    mix([14, 15, 26], [58, 60, 70], light),
  );
  ctx.strokeStyle = mix([70, 72, 96], [200, 196, 180], light);
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 18]);
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 32);
  ctx.lineTo(w, GROUND_Y + 32);
  ctx.stroke();
  ctx.setLineDash([]);
  const pole = mix([50, 54, 80], [90, 92, 110], light);
  for (let lx = 70; lx < w; lx += 260) streetLamp(ctx, lx, light, pole);
}

function drawCity(ctx: CanvasRenderingContext2D, state: GameState, light: number) {
  const w = state.width;
  // Far skyline, then nearer towers with lit windows.
  const far = mix([24, 26, 70], [130, 120, 160], light);
  const near = mix([12, 14, 38], [70, 72, 96], light);
  const lit = windowLight(light);
  for (const [color, scale, seed, windows] of [
    [far, 0.75, 20, false],
    [near, 1, 40, true],
  ] as const) {
    let x = -10;
    let i = seed;
    while (x < w) {
      const bw = 40 + hash(i) * 50;
      const bh = (90 + hash(i + 1) * 150) * scale;
      const base = GROUND_Y - 26;
      ctx.fillStyle = color;
      ctx.fillRect(x, base - bh, bw, bh);
      if (hash(i + 2) > 0.7) ctx.fillRect(x + bw / 2 - 2, base - bh - 18, 4, 18);
      if (windows) {
        ctx.fillStyle = lit;
        for (let wy = base - bh + 10; wy < base - 12; wy += 16) {
          for (let wx = x + 7; wx < x + bw - 10; wx += 12) {
            if (hash(wx * 3.1 + wy * 7.7) > 0.72) ctx.fillRect(wx, wy, 5, 7);
          }
        }
      }
      x += bw + 4 + hash(i + 3) * 10;
      i++;
    }
  }
  ctx.fillStyle = mix([34, 36, 58], [140, 138, 144], light);
  ctx.fillRect(0, GROUND_Y - 26, w, 22);
  groundBand(
    ctx,
    w,
    mix([24, 25, 40], [90, 92, 100], light),
    mix([10, 11, 20], [50, 52, 60], light),
  );
  ctx.strokeStyle = mix([110, 100, 60], [220, 200, 120], light);
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 20]);
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 32);
  ctx.lineTo(w, GROUND_Y + 32);
  ctx.stroke();
  ctx.setLineDash([]);
  const pole = mix([44, 48, 72], [90, 92, 110], light);
  for (let lx = 150; lx < w; lx += 300) streetLamp(ctx, lx, light, pole);
}

function drawPlace(ctx: CanvasRenderingContext2D, state: GameState, light: number) {
  if (state.location.id === "town") drawTown(ctx, state, light);
  else if (state.location.id === "city") drawCity(ctx, state, light);
  else drawFarm(ctx, state, light);
}

function drawBeam(ctx: CanvasRenderingContext2D, state: GameState, view: View) {
  const x = state.saucerX;
  const top = HATCH_Y - 8;
  const half = beamHalfWidth(GROUND_Y, state.level);
  if (!state.beamOn) {
    // Where the beam would land: a soft ring on the ground helps aim.
    ctx.strokeStyle = "rgba(159,245,214,0.35)";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ellipse(ctx, x, GROUND_Y + 4, half, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  const grad = ctx.createLinearGradient(0, top, 0, GROUND_Y);
  grad.addColorStop(0, "rgba(190,255,232,0.55)");
  grad.addColorStop(1, "rgba(159,245,214,0.16)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - beamHalfWidth(top, state.level), top);
  ctx.lineTo(x + beamHalfWidth(top, state.level), top);
  ctx.lineTo(x + half, GROUND_Y + 4);
  ctx.lineTo(x - half, GROUND_Y + 4);
  ctx.closePath();
  ctx.fill();
  // Rings drifting up the beam.
  if (!view.reducedMotion) {
    ctx.strokeStyle = "rgba(220,255,244,0.45)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const t = (view.clock * 0.9 + i / 4) % 1;
      const y = GROUND_Y - t * (GROUND_Y - top);
      const hw = beamHalfWidth(y, state.level);
      ctx.globalAlpha = Math.sin(t * Math.PI);
      ellipse(ctx, x, y, hw, 4 + hw * 0.08);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "rgba(190,255,232,0.35)";
  ellipse(ctx, x, GROUND_Y + 4, half, 9);
  ctx.fill();
}

function legs(
  ctx: CanvasRenderingContext2D,
  xs: number[],
  top: number,
  len: number,
  swing: number,
) {
  ctx.lineCap = "round";
  ctx.beginPath();
  xs.forEach((lx, i) => {
    const s = (i % 2 === 0 ? 1 : -1) * swing;
    ctx.moveTo(lx, top);
    ctx.lineTo(lx + s, top + len);
  });
  ctx.stroke();
}

function wheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = "#1b1d26";
  ellipse(ctx, x, y, r, r);
  ctx.fill();
  ctx.fillStyle = "#8e93a6";
  ellipse(ctx, x, y, r * 0.42, r * 0.42);
  ctx.fill();
}

function headlight(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const beam = ctx.createLinearGradient(x, 0, x + 76, 0);
  beam.addColorStop(0, "rgba(255,236,180,0.35)");
  beam.addColorStop(1, "rgba(255,236,180,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x + 76, y - 16);
  ctx.lineTo(x + 76, y + 18);
  ctx.lineTo(x, y + 4);
  ctx.fill();
  ctx.fillStyle = "#ffeab0";
  ellipse(ctx, x - 1, y, 3, 3);
  ctx.fill();
}

/** A rounded car shape: body, cabin, windows, wheels and headlights. */
function vehicleBody(
  ctx: CanvasRenderingContext2D,
  color: string,
  shade: string,
  width: number,
  height: number,
) {
  const half = width / 2;
  headlight(ctx, half, -height * 0.45);
  ctx.fillStyle = color;
  rrect(ctx, -half, -height * 0.62, width, height * 0.5, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-half * 0.55, -height * 0.6);
  ctx.lineTo(-half * 0.35, -height);
  ctx.lineTo(half * 0.35, -height);
  ctx.lineTo(half * 0.6, -height * 0.6);
  ctx.fill();
  ctx.fillStyle = "#a9d3dc";
  ctx.beginPath();
  ctx.moveTo(-half * 0.45, -height * 0.64);
  ctx.lineTo(-half * 0.3, -height * 0.93);
  ctx.lineTo(-half * 0.03, -height * 0.93);
  ctx.lineTo(-half * 0.03, -height * 0.64);
  ctx.moveTo(half * 0.03, -height * 0.64);
  ctx.lineTo(half * 0.03, -height * 0.93);
  ctx.lineTo(half * 0.3, -height * 0.93);
  ctx.lineTo(half * 0.5, -height * 0.64);
  ctx.fill();
  ctx.fillStyle = shade;
  ctx.fillRect(-half + 4, -height * 0.34, width - 8, 3);
  wheel(ctx, -half * 0.55, -9, 9);
  wheel(ctx, half * 0.55, -9, 9);
}

interface PersonLook {
  shirt: string;
  legs: string;
  skin: string;
}

function person(ctx: CanvasRenderingContext2D, swing: number, look: PersonLook) {
  ctx.strokeStyle = look.legs;
  ctx.lineWidth = 4;
  legs(ctx, [-3, 3], -16, 16, swing * 0.7);
  ctx.fillStyle = look.shirt;
  rrect(ctx, -7, -33, 14, 19, 4);
  ctx.fill();
  ctx.strokeStyle = look.skin;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, -30);
  ctx.lineTo(-10, -21 - swing * 0.4);
  ctx.moveTo(6, -30);
  ctx.lineTo(10, -21 + swing * 0.4);
  ctx.stroke();
  ctx.fillStyle = look.skin;
  ellipse(ctx, 0, -39, 6, 6);
  ctx.fill();
  ctx.fillStyle = "#1a1a22";
  ellipse(ctx, 3, -39, 1, 1.2);
  ctx.fill();
}

/**
 * A jogger mid-stride: leaning forward, knees bent, elbows bent and pumping, with a small bounce.
 * `swing` runs from -4 to 4 as they move (0 when standing still or with reduced motion).
 */
function jogger(ctx: CanvasRenderingContext2D, swing: number, look: PersonLook) {
  const s = Math.max(-1, Math.min(1, swing / 4));
  ctx.save();
  ctx.translate(0, -Math.abs(s) * 3);
  ctx.rotate(0.14);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Legs: hip, knee, foot. The back leg is drawn darker so the two read apart.
  const leg = (dir: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(6 * dir + 2, -8);
    ctx.lineTo(9 * dir - 2 * Math.abs(dir), -1 - 3 * Math.max(0, -dir));
    ctx.stroke();
  };
  leg(-s, "#1f2740");
  leg(s, look.legs);
  ctx.fillStyle = look.shirt;
  rrect(ctx, -6, -33, 12, 18, 4);
  ctx.fill();
  // Arms bent at the elbow, swinging opposite to the legs.
  const arm = (dir: number) => {
    ctx.strokeStyle = look.skin;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(-6 * dir, -23);
    ctx.lineTo(-6 * dir + 6, -27);
    ctx.stroke();
  };
  arm(-s);
  arm(s);
  ctx.fillStyle = look.skin;
  ellipse(ctx, 2, -39, 6, 6);
  ctx.fill();
  ctx.fillStyle = "#1a1a22";
  ellipse(ctx, 5, -39, 1, 1.2);
  ctx.fill();
  ctx.restore();
}

/** Seven skin tones, shared by every person in the game. */
const SKIN_TONES = ["#f6d5b8", "#e8b98f", "#d49a6a", "#b47a4c", "#8d5a36", "#6a4128", "#47291a"];

/** Spreads people across the skin tones (entity ids are sequential, so mix them up). */
function skinFor(variant: number): string {
  return SKIN_TONES[(variant * 5 + 3) % SKIN_TONES.length]!;
}
const HAIR_COLORS = ["#1c1714", "#3b2618", "#6b4423", "#b5884e", "#8c8c94"];
const COATS = ["#4c5470", "#6a4c6e", "#3f6158", "#7a5a3e"];

/** Hair on a person's head (centered at 0, -39, radius 6), facing right. */
function hair(ctx: CanvasRenderingContext2D, style: number, color: string) {
  ctx.fillStyle = color;
  const base = () => {
    // Crown and the back of the head (people face right, so the back is on the left).
    ellipse(ctx, -0.5, -42, 6.6, 4.2);
    ctx.fill();
    ellipse(ctx, -3.6, -39, 3.4, 5);
    ctx.fill();
    // A few tufts so it reads as hair, not a hat.
    for (const [x, y, r] of [
      [-4, -45, 2.4],
      [-0.5, -46.2, 2.6],
      [3, -45.4, 2.3],
      [5.2, -43, 1.8],
    ] as const) {
      ellipse(ctx, x, y, r, r);
      ctx.fill();
    }
  };
  if (style === 0) {
    base();
  } else if (style === 1) {
    // Bun on top.
    base();
    ellipse(ctx, -2.5, -48.5, 3.4, 3);
    ctx.fill();
  } else if (style === 2) {
    // Big curls.
    for (const [x, y] of [
      [-5, -41],
      [-2, -45],
      [2, -45.5],
      [5.5, -43],
      [-6.5, -37],
    ] as const) {
      ellipse(ctx, x, y, 3.8, 3.8);
      ctx.fill();
    }
  } else {
    // Ponytail out the back.
    base();
    ctx.beginPath();
    ctx.ellipse(-8.5, -37, 2.6, 5.5, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Each thing drawn facing right with its feet at (0, 0). */
type Painter = (ctx: CanvasRenderingContext2D, swing: number, variant: number) => void;

const PAINTERS: Record<Kind, Painter> = {
  chicken(ctx, swing) {
    ctx.strokeStyle = "#e9a43a";
    ctx.lineWidth = 2;
    legs(ctx, [-3, 3], -7, 7, swing * 0.5);
    ctx.fillStyle = "#f3efe6";
    ellipse(ctx, -1, -12, 10, 7);
    ctx.fill();
    ellipse(ctx, 6, -19, 5, 5);
    ctx.fill();
    ctx.fillStyle = "#e0523f";
    ellipse(ctx, 6, -24, 3, 2.5);
    ctx.fill();
    ctx.fillStyle = "#f0b23e";
    ctx.beginPath();
    ctx.moveTo(10, -20);
    ctx.lineTo(14, -18.5);
    ctx.lineTo(10, -17);
    ctx.fill();
    ctx.fillStyle = "#1a1a22";
    ellipse(ctx, 7.5, -20, 1, 1);
    ctx.fill();
  },
  sheep(ctx, swing) {
    ctx.strokeStyle = "#2a2730";
    ctx.lineWidth = 3;
    legs(ctx, [-10, -4, 5, 11], -9, 9, swing * 0.4);
    ctx.fillStyle = "#ece6d6";
    for (const [x, y, r] of [
      [-10, -16, 8],
      [-2, -20, 9],
      [7, -16, 8],
      [-4, -12, 9],
    ] as const) {
      ellipse(ctx, x, y, r, r);
      ctx.fill();
    }
    ctx.fillStyle = "#2a2730";
    ellipse(ctx, 15, -18, 5, 6);
    ctx.fill();
    ctx.fillStyle = "#f3efe6";
    ellipse(ctx, 17, -19.5, 1.1, 1.1);
    ctx.fill();
  },
  farmer(ctx, swing, variant) {
    const skin = skinFor(variant);
    const lady = variant % 2 === 0;
    const shirt = ["#c95f4c", "#d9a03f", "#5f8f6a", "#8a6bb0"][Math.floor(variant / 2) % 4]!;
    const hairColor = HAIR_COLORS[(variant * 3) % HAIR_COLORS.length]!;
    // A braid down the back, drawn before the body.
    if (lady) {
      ctx.fillStyle = hairColor;
      for (let i = 0; i < 4; i++) {
        ellipse(ctx, -5.5 - i * 0.6, -38 + i * 4, 2.6, 2.4);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "#3d4d7a";
    ctx.lineWidth = 4;
    legs(ctx, [-3, 3], -16, 16, swing * 0.7);
    // Overalls with a shirt underneath.
    ctx.fillStyle = "#4a5f96";
    rrect(ctx, -7, -32, 14, 18, 4);
    ctx.fill();
    ctx.fillStyle = shirt;
    rrect(ctx, -7, -32, 14, 7, 3);
    ctx.fill();
    ctx.strokeStyle = skin;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, -29);
    ctx.lineTo(-10, -20 - swing * 0.4);
    ctx.moveTo(6, -29);
    ctx.lineTo(10, -20 + swing * 0.4);
    ctx.stroke();
    ctx.fillStyle = skin;
    ellipse(ctx, 0, -38, 6, 6);
    ctx.fill();
    if (lady) {
      // Hair framing the face under the hat brim.
      ctx.fillStyle = hairColor;
      ellipse(ctx, -3.5, -39, 3.4, 4.6);
      ctx.fill();
    }
    ctx.fillStyle = "#e3c06e";
    ellipse(ctx, 0, -42, 11, 2.6);
    ctx.fill();
    rrect(ctx, -5, -49, 10, 7, 3);
    ctx.fill();
    ctx.fillStyle = "#1a1a22";
    ellipse(ctx, 3, -38, 1, 1.2);
    ctx.fill();
  },
  cow(ctx, swing) {
    ctx.strokeStyle = "#e9e4dc";
    ctx.lineWidth = 5;
    legs(ctx, [-19, -12, 11, 18], -13, 13, swing * 0.35);
    ctx.fillStyle = "#efe9df";
    rrect(ctx, -26, -36, 50, 25, 11);
    ctx.fill();
    ctx.fillStyle = "#2c2a33";
    ellipse(ctx, -12, -27, 7, 6);
    ctx.fill();
    ellipse(ctx, 8, -31, 6, 4);
    ctx.fill();
    // Udder, with little teats, tucked under the belly toward the back legs.
    ctx.fillStyle = "#eaa6a6";
    ellipse(ctx, -2, -11, 8, 4.5);
    ctx.fill();
    for (const tx of [-6, -2, 2]) {
      rrect(ctx, tx - 1, -9, 2.2, 4, 1);
      ctx.fill();
    }
    // Head and snout; soft ears instead of horns.
    ctx.fillStyle = "#efe9df";
    rrect(ctx, 18, -44, 16, 17, 6);
    ctx.fill();
    ellipse(ctx, 17, -41, 5, 2.6);
    ctx.fill();
    ctx.fillStyle = "#e7a7a3";
    rrect(ctx, 23, -33, 13, 8, 4);
    ctx.fill();
    ctx.fillStyle = "#1a1a22";
    ellipse(ctx, 28, -38, 1.4, 1.6);
    ctx.fill();
    ctx.strokeStyle = "#2c2a33";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-26, -32);
    ctx.quadraticCurveTo(-32, -26, -30, -18);
    ctx.stroke();
  },
  hay(ctx) {
    ctx.fillStyle = "#d9b15a";
    rrect(ctx, -20, -32, 40, 32, 9);
    ctx.fill();
    ctx.strokeStyle = "#b08a3c";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let y = -26; y < -2; y += 6) {
      ctx.moveTo(-16, y);
      ctx.lineTo(16, y + 1);
    }
    ctx.stroke();
    ctx.strokeStyle = "#8a5a2e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -32);
    ctx.lineTo(-8, 0);
    ctx.moveTo(8, -32);
    ctx.lineTo(8, 0);
    ctx.stroke();
  },
  table(ctx) {
    ctx.strokeStyle = "#7a5034";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-8, -22);
    ctx.moveTo(18, 0);
    ctx.lineTo(8, -22);
    ctx.moveTo(-8, 0);
    ctx.lineTo(-18, -22);
    ctx.moveTo(8, 0);
    ctx.lineTo(18, -22);
    ctx.stroke();
    ctx.fillStyle = "#9c6a44";
    rrect(ctx, -28, -26, 56, 6, 2);
    ctx.fill();
    rrect(ctx, -26, -11, 52, 4, 2);
    ctx.fill();
  },
  tractor(ctx) {
    ctx.fillStyle = "#c8553d";
    rrect(ctx, -30, -34, 46, 20, 4);
    ctx.fill();
    rrect(ctx, 10, -28, 26, 14, 4);
    ctx.fill();
    ctx.fillStyle = "#e9e1d0";
    rrect(ctx, -26, -52, 22, 20, 3);
    ctx.fill();
    ctx.fillStyle = "#88b6c9";
    rrect(ctx, -23, -49, 16, 11, 2);
    ctx.fill();
    ctx.fillStyle = "#3b3a44";
    ctx.fillRect(18, -42, 4, 14);
    wheel(ctx, -18, -16, 16);
    wheel(ctx, 26, -9, 9);
    ctx.fillStyle = "rgba(255,230,160,0.9)";
    ellipse(ctx, 36, -22, 2.5, 2.5);
    ctx.fill();
  },
  truck(ctx) {
    // Headlights on at night.
    const beam = ctx.createLinearGradient(46, 0, 120, 0);
    beam.addColorStop(0, "rgba(255,236,180,0.35)");
    beam.addColorStop(1, "rgba(255,236,180,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(44, -22);
    ctx.lineTo(120, -34);
    ctx.lineTo(120, 0);
    ctx.lineTo(44, -14);
    ctx.fill();
    ctx.fillStyle = "#3f8f99";
    rrect(ctx, -46, -30, 92, 20, 6);
    ctx.fill();
    rrect(ctx, -2, -46, 32, 20, 6);
    ctx.fill();
    ctx.fillStyle = "#a9d3dc";
    rrect(ctx, 4, -42, 22, 11, 3);
    ctx.fill();
    ctx.fillStyle = "#2c6670";
    ctx.fillRect(-42, -34, 36, 5);
    wheel(ctx, -26, -9, 10);
    wheel(ctx, 28, -9, 10);
    ctx.fillStyle = "#ffeab0";
    ellipse(ctx, 44, -19, 3, 3);
    ctx.fill();
  },
  combine(ctx) {
    headlight(ctx, 66, -40);
    // Grain tank and body.
    ctx.fillStyle = "#c98f3a";
    rrect(ctx, -60, -62, 40, 16, 4);
    ctx.fill();
    ctx.fillStyle = "#e0a948";
    rrect(ctx, -64, -48, 112, 30, 6);
    ctx.fill();
    // Unloading pipe folded along the side.
    ctx.strokeStyle = "#9a6a2a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-58, -58);
    ctx.lineTo(-20, -70);
    ctx.stroke();
    // Cab.
    ctx.fillStyle = "#e0a948";
    rrect(ctx, 14, -72, 30, 26, 4);
    ctx.fill();
    ctx.fillStyle = "#a9d3dc";
    rrect(ctx, 19, -68, 21, 15, 2);
    ctx.fill();
    // Header with a turning reel out front.
    ctx.fillStyle = "#6e6a78";
    rrect(ctx, 48, -30, 18, 22, 3);
    ctx.fill();
    ctx.strokeStyle = "#3b3a44";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(57, -34, 9, 0, Math.PI * 2);
    ctx.moveTo(48, -34);
    ctx.lineTo(66, -34);
    ctx.moveTo(57, -43);
    ctx.lineTo(57, -25);
    ctx.stroke();
    wheel(ctx, 24, -16, 16);
    wheel(ctx, -44, -11, 10);
  },
  // --- Town ---
  cat(ctx, swing) {
    ctx.strokeStyle = "#3a3346";
    ctx.lineWidth = 3;
    legs(ctx, [-7, -3, 4, 8], -8, 8, swing * 0.4);
    ctx.fillStyle = "#4a4258";
    ellipse(ctx, 0, -12, 11, 6);
    ctx.fill();
    ellipse(ctx, 10, -17, 6, 5.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -20);
    ctx.lineTo(7, -26);
    ctx.lineTo(10, -21);
    ctx.moveTo(11, -21);
    ctx.lineTo(14, -26);
    ctx.lineTo(15, -19);
    ctx.fill();
    ctx.strokeStyle = "#4a4258";
    ctx.beginPath();
    ctx.moveTo(-10, -13);
    ctx.quadraticCurveTo(-18, -16, -16, -26);
    ctx.stroke();
    // Half-closed, unimpressed eyes.
    ctx.strokeStyle = "#e9e27a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(9, -17.5);
    ctx.lineTo(11.5, -17.5);
    ctx.moveTo(13, -17.5);
    ctx.lineTo(15, -17.5);
    ctx.stroke();
  },
  dog(ctx, swing) {
    ctx.strokeStyle = "#a8743f";
    ctx.lineWidth = 4;
    legs(ctx, [-10, -5, 6, 11], -10, 10, swing * 0.5);
    ctx.fillStyle = "#c48a4c";
    rrect(ctx, -14, -22, 28, 13, 6);
    ctx.fill();
    rrect(ctx, 9, -30, 14, 13, 5);
    ctx.fill();
    ctx.fillStyle = "#8a5a30";
    rrect(ctx, 9, -30, 5, 12, 3);
    ctx.fill();
    ctx.fillStyle = "#2a1d14";
    ellipse(ctx, 23, -23, 2.2, 2);
    ctx.fill();
    ellipse(ctx, 18, -26, 1.2, 1.2);
    ctx.fill();
    ctx.strokeStyle = "#c48a4c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, -19);
    ctx.lineTo(-20, -26 + swing * 0.5);
    ctx.stroke();
    ctx.fillStyle = "#d9534f";
    ctx.fillRect(7, -21, 4, 3);
  },
  jogger(ctx, swing, variant) {
    jogger(ctx, swing * 1.4, {
      shirt: ["#e2735a", "#4f9fd0", "#9ccf6b"][variant % 3]!,
      legs: "#2f3a58",
      skin: skinFor(variant),
    });
    // Headband, drawn in the same lean as the runner.
    ctx.save();
    ctx.translate(0, -Math.abs(Math.max(-1, Math.min(1, (swing * 1.4) / 4))) * 3);
    ctx.rotate(0.14);
    ctx.fillStyle = "#9ff5d6";
    ctx.fillRect(-4, -42, 12, 2.5);
    ctx.restore();
  },
  pizza(ctx, swing, variant) {
    person(ctx, swing * 0.6, { shirt: "#d9534f", legs: "#3a3f55", skin: skinFor(variant) });
    // Cap and a pizza box held out in front.
    ctx.fillStyle = "#d9534f";
    ctx.beginPath();
    ctx.arc(0, -42, 6.5, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(2, -43, 8, 2.5);
    ctx.fillStyle = "#e8d3a8";
    rrect(ctx, 4, -27, 18, 5, 1.5);
    ctx.fill();
    ctx.fillStyle = "#c9a76a";
    ctx.fillRect(6, -25.5, 14, 1);
  },
  bin(ctx) {
    ctx.fillStyle = "#3f6e5a";
    ctx.beginPath();
    ctx.moveTo(-11, -32);
    ctx.lineTo(11, -32);
    ctx.lineTo(9, 0);
    ctx.lineTo(-9, 0);
    ctx.fill();
    ctx.fillStyle = "#2f5444";
    rrect(ctx, -13, -36, 26, 6, 2);
    ctx.fill();
    ctx.strokeStyle = "#2f5444";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const x of [-5, 0, 5]) {
      ctx.moveTo(x, -27);
      ctx.lineTo(x * 0.85, -4);
    }
    ctx.stroke();
  },
  bench(ctx) {
    ctx.strokeStyle = "#3b3a44";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-22, -26);
    ctx.moveTo(22, 0);
    ctx.lineTo(22, -26);
    ctx.stroke();
    ctx.fillStyle = "#7a5a3e";
    rrect(ctx, -28, -14, 56, 5, 2);
    ctx.fill();
    rrect(ctx, -28, -22, 56, 4, 2);
    ctx.fill();
    rrect(ctx, -28, -28, 56, 4, 2);
    ctx.fill();
  },
  mailbox(ctx) {
    ctx.fillStyle = "#3d4f8c";
    rrect(ctx, -11, -44, 22, 30, 8);
    ctx.fill();
    ctx.fillRect(-11, -26, 22, 18);
    ctx.fillStyle = "#2c3a6a";
    ctx.fillRect(-7, -8, 4, 8);
    ctx.fillRect(3, -8, 4, 8);
    ctx.fillStyle = "#cfd5ea";
    rrect(ctx, -7, -38, 14, 3, 1.5);
    ctx.fill();
  },
  car(ctx) {
    vehicleBody(ctx, "#b5484a", "#8e3236", 84, 38);
  },
  foodtruck(ctx) {
    headlight(ctx, 52, -18);
    ctx.fillStyle = "#e8b04b";
    rrect(ctx, -52, -60, 80, 48, 6);
    ctx.fill();
    rrect(ctx, 26, -40, 26, 28, 6);
    ctx.fill();
    ctx.fillStyle = "#a9d3dc";
    rrect(ctx, 32, -36, 14, 11, 2);
    ctx.fill();
    // Serving window with a striped awning.
    ctx.fillStyle = "#2b2733";
    rrect(ctx, -42, -50, 54, 20, 3);
    ctx.fill();
    ctx.fillStyle = "#ffe8b0";
    ctx.fillRect(-40, -48, 50, 4);
    for (let x = -44; x < 14; x += 12) {
      ctx.fillStyle = "#d85a4a";
      ctx.fillRect(x, -58, 6, 6);
      ctx.fillStyle = "#f4efe6";
      ctx.fillRect(x + 6, -58, 6, 6);
    }
    wheel(ctx, -32, -10, 11);
    wheel(ctx, 34, -10, 11);
  },

  // --- City ---
  pigeon(ctx, swing) {
    ctx.strokeStyle = "#d07a6a";
    ctx.lineWidth = 1.5;
    legs(ctx, [-2, 2], -5, 5, swing * 0.3);
    ctx.fillStyle = "#8d90a6";
    ellipse(ctx, -1, -9, 8, 5);
    ctx.fill();
    ctx.fillStyle = "#6e7290";
    ellipse(ctx, 5, -13, 4, 4);
    ctx.fill();
    ctx.fillStyle = "#7fae9a";
    ellipse(ctx, 3, -10, 3, 2);
    ctx.fill();
    // Eye, then a short pointed beak with a pale patch at its base.
    ctx.fillStyle = "#e9a43a";
    ellipse(ctx, 5.5, -14, 1.2, 1.2);
    ctx.fill();
    ctx.fillStyle = "#1a1a22";
    ellipse(ctx, 5.7, -14, 0.6, 0.6);
    ctx.fill();
    ctx.fillStyle = "#3b3a44";
    ctx.beginPath();
    ctx.moveTo(8.4, -14);
    ctx.lineTo(12.5, -12.6);
    ctx.lineTo(8.4, -11.6);
    ctx.fill();
    ctx.fillStyle = "#e8e6ee";
    ellipse(ctx, 8.6, -13.9, 1.1, 0.7);
    ctx.fill();
  },
  raccoon(ctx, swing) {
    ctx.strokeStyle = "#3e3b44";
    ctx.lineWidth = 3;
    legs(ctx, [-9, -4, 4, 9], -8, 8, swing * 0.4);
    ctx.fillStyle = "#77737f";
    ellipse(ctx, 0, -13, 13, 7);
    ctx.fill();
    // Two small rounded ears.
    ellipse(ctx, 9.5, -22.5, 2.6, 3);
    ctx.fill();
    ellipse(ctx, 15, -23, 2.6, 3);
    ctx.fill();
    ellipse(ctx, 12, -17, 6.5, 6);
    ctx.fill();
    ctx.fillStyle = "#2a2830";
    rrect(ctx, 9, -20, 10, 4, 2);
    ctx.fill();
    ctx.fillStyle = "#f3efe6";
    ellipse(ctx, 15, -18, 1.1, 1.1);
    ctx.fill();
    // Ringed tail.
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? "#2a2830" : "#9a96a2";
      ellipse(ctx, -14 - i * 3.5, -15 - i * 2.5, 3.4, 3);
      ctx.fill();
    }
  },
  commuter(ctx, swing, variant) {
    const skin = skinFor(variant);
    const suit = variant % 2 === 1;
    const coat = suit
      ? ["#2b2f3f", "#3a3a44", "#2d3a52"][variant % 3]!
      : COATS[Math.floor(variant / 2) % COATS.length]!;
    person(ctx, swing * 0.8, { shirt: coat, legs: suit ? coat : "#2c3044", skin });
    if (suit) {
      // White shirt in a V, lapels and a tie.
      ctx.fillStyle = "#eef0f4";
      ctx.beginPath();
      ctx.moveTo(-3, -33);
      ctx.lineTo(3, -33);
      ctx.lineTo(0, -25);
      ctx.fill();
      ctx.fillStyle = ["#c95f4c", "#d9a03f", "#4f9fd0"][Math.floor(variant / 2) % 3]!;
      ctx.beginPath();
      ctx.moveTo(-0.9, -32);
      ctx.lineTo(0.9, -32);
      ctx.lineTo(1.4, -25);
      ctx.lineTo(0, -23.5);
      ctx.lineTo(-1.4, -25);
      ctx.fill();
    }
    hair(ctx, Math.floor(variant / 3) % 4, HAIR_COLORS[(variant * 7) % HAIR_COLORS.length]!);
    ctx.fillStyle = suit ? "#3b2a1e" : "#6e4a32";
    rrect(ctx, 6, -22 + swing * 0.3, 10, 8, 2);
    ctx.fill();
  },
  cart(ctx) {
    ctx.fillStyle = "#d8d4cc";
    rrect(ctx, -24, -32, 44, 22, 4);
    ctx.fill();
    ctx.fillStyle = "#c95f4c";
    ctx.fillRect(-24, -20, 44, 4);
    // Umbrella.
    ctx.strokeStyle = "#5a5866";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -32);
    ctx.lineTo(-2, -44);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? "#f4efe6" : "#e2735a";
      ctx.beginPath();
      ctx.moveTo(-2, -54);
      ctx.lineTo(-26 + i * 12, -44);
      ctx.lineTo(-14 + i * 12, -44);
      ctx.fill();
    }
    ctx.strokeStyle = "#5a5866";
    ctx.beginPath();
    ctx.moveTo(-24, -26);
    ctx.lineTo(-32, -34);
    ctx.stroke();
    wheel(ctx, -14, -7, 7);
    wheel(ctx, 12, -7, 7);
  },
  taxi(ctx) {
    vehicleBody(ctx, "#f0c24a", "#c99a26", 84, 40);
    ctx.fillStyle = "#2b2733";
    rrect(ctx, -6, -46, 14, 6, 2);
    ctx.fill();
    ctx.fillStyle = "#ffe8b0";
    ctx.fillRect(-4, -44, 10, 2);
  },
  bus(ctx) {
    headlight(ctx, 75, -16);
    ctx.fillStyle = "#3e7fb8";
    rrect(ctx, -75, -60, 150, 50, 8);
    ctx.fill();
    ctx.fillStyle = "#ffe8b0";
    for (let x = -66; x < 50; x += 22) {
      rrect(ctx, x, -52, 17, 16, 3);
      ctx.fill();
    }
    ctx.fillStyle = "#a9d3dc";
    rrect(ctx, 56, -52, 15, 24, 3);
    ctx.fill();
    ctx.fillStyle = "#2f5f8c";
    ctx.fillRect(-75, -30, 150, 5);
    wheel(ctx, -48, -10, 11);
    wheel(ctx, 48, -10, 11);
  },
};

function drawEntity(ctx: CanvasRenderingContext2D, state: GameState, e: Entity, view: View) {
  const spec = KINDS[e.kind];
  const heavy = spec.tier > state.level;
  const moving = e.speed > 0 && (e.state === "wander" || e.state === "flee");
  const swing = moving && !view.reducedMotion ? Math.sin(e.x * 0.35) * 4 : 0;
  ctx.save();
  ctx.globalAlpha = e.fade;
  // Something new just arrived: a soft halo and a "New!" tag (text, not just a glow).
  if (e.glow > 0) {
    const a = Math.min(1, e.glow);
    const pulse = view.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(view.clock * 6);
    const halo = ctx.createRadialGradient(
      e.x,
      e.y - spec.height / 2,
      4,
      e.x,
      e.y - spec.height / 2,
      spec.width,
    );
    halo.addColorStop(0, `rgba(255,224,138,${0.45 * a * pulse})`);
    halo.addColorStop(1, "rgba(255,224,138,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(
      e.x - spec.width,
      e.y - spec.height / 2 - spec.width,
      spec.width * 2,
      spec.width * 2,
    );
    ctx.globalAlpha = a * e.fade;
    ctx.font = "700 13px Sora, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe08a";
    rrect(ctx, e.x - 22, e.y - spec.height - 40, 44, 20, 10);
    ctx.fill();
    ctx.fillStyle = "#1a1a2a";
    ctx.textBaseline = "middle";
    ctx.fillText("New!", e.x, e.y - spec.height - 30);
    ctx.globalAlpha = e.fade;
  }
  // Contact shadow; shrinks as it rises.
  ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - e.lift)})`;
  ellipse(ctx, e.x, GROUND_Y + 2, (spec.width / 2) * (1 - e.lift * 0.6), 4);
  ctx.fill();

  let dx = 0;
  let tilt = 0;
  if (e.state === "held" && heavy) {
    const amt = Math.min(1, e.strain * 2.5);
    tilt = view.reducedMotion ? 0.08 * amt : Math.sin(view.clock * 32) * 0.12 * amt;
    dx = view.reducedMotion ? 0 : Math.sin(view.clock * 41) * 2.5 * amt;
  } else if (e.state === "held" || e.state === "fall") {
    tilt = view.reducedMotion ? 0 : Math.sin(view.clock * 9 + e.id) * 0.18;
  }
  const bob = e.state === "flee" && !view.reducedMotion ? -Math.abs(Math.sin(e.x * 0.18)) * 3 : 0;
  ctx.translate(e.x + dx, e.y + bob);
  ctx.rotate(tilt);
  if (e.dir === -1) ctx.scale(-1, 1);
  // Shrink a little as it reaches the hatch.
  const s = 1 - Math.max(0, e.lift - 0.75) * 1.6;
  ctx.scale(s, s);
  PAINTERS[e.kind](ctx, swing, e.id);
  ctx.restore();

  // Things that are still too heavy carry a small lock, so it never depends on color.
  if (heavy && e.fade >= 1)
    drawLock(ctx, e.x, e.y - spec.height - 14, state.beamOn && e.state === "held");
}

function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean) {
  ctx.save();
  if (active) {
    ctx.font = "600 13px Sora, system-ui, sans-serif";
    const label = "Too heavy";
    const w = ctx.measureText(label).width + 30;
    ctx.fillStyle = "rgba(10,12,36,0.85)";
    rrect(ctx, x - w / 2, y - 12, w, 22, 11);
    ctx.fill();
    ctx.fillStyle = "#fff4d6";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x - w / 2 + 24, y - 1);
    x = x - w / 2 + 13;
  } else {
    ctx.globalAlpha = 0.75;
  }
  ctx.strokeStyle = "#fff4d6";
  ctx.fillStyle = "#fff4d6";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(x, y - 4, 3.5, Math.PI, 0);
  ctx.stroke();
  rrect(ctx, x - 5, y - 4, 10, 8, 2);
  ctx.fill();
  ctx.restore();
}

/** Rim lights travel around the disc: big and bright in front, small and dim at the back. */
function rimLights(ctx: CanvasRenderingContext2D, view: View, front: boolean) {
  const count = 10;
  const spin = view.reducedMotion ? 0 : view.clock * 0.9;
  for (let i = 0; i < count; i++) {
    const a = spin + (i / count) * Math.PI * 2;
    const depth = Math.sin(a); // 1 = nearest the viewer, -1 = far side
    if (front !== depth >= 0) continue;
    const x = Math.cos(a) * 47;
    const y = 2 + depth * 8;
    const r = 1.4 + 1.6 * (depth + 1) * 0.6;
    const blink = view.reducedMotion ? 1 : 0.65 + 0.35 * Math.sin(view.clock * 5 + i * 1.7);
    ctx.globalAlpha = front ? blink : 0.35 + 0.25 * (depth + 1);
    ctx.fillStyle = i % 3 === 0 ? "#9ff5d6" : "#ffe08a";
    ellipse(ctx, x, y, r * 1.15, r * 0.8);
    ctx.fill();
    if (front && depth > 0.5) {
      ctx.globalAlpha = 0.25 * blink;
      ellipse(ctx, x, y, r * 2.6, r * 1.8);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawSaucer(ctx: CanvasRenderingContext2D, state: GameState, view: View) {
  const bob = view.reducedMotion ? 0 : Math.sin(view.clock * 2.2) * 3;
  const tilt = Math.max(-0.18, Math.min(0.18, state.saucerVx / 2200));
  ctx.save();
  ctx.translate(state.saucerX, SAUCER_Y + bob);
  ctx.rotate(tilt);
  // Underside and rim give the disc some thickness.
  ctx.fillStyle = "#5d5a80";
  ellipse(ctx, 0, 6, 52, 11);
  ctx.fill();
  const disc = ctx.createLinearGradient(0, -10, 0, 10);
  disc.addColorStop(0, "#f0eef9");
  disc.addColorStop(0.55, "#b9b6d4");
  disc.addColorStop(1, "#7d7aa2");
  ctx.fillStyle = disc;
  ellipse(ctx, 0, 1, 54, 11);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 1, 52, 9.5, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  rimLights(ctx, view, false);
  // Dome with a small pilot.
  ctx.fillStyle = "rgba(170,230,255,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, -4, 22, 22, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#8fe3a8";
  ellipse(ctx, 0, -10, 7, 8);
  ctx.fill();
  ctx.strokeStyle = "#8fe3a8";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-3, -17);
  ctx.lineTo(-6, -24);
  ctx.moveTo(3, -17);
  ctx.lineTo(6, -24);
  ctx.stroke();
  ctx.fillStyle = "#1a1a2a";
  ellipse(ctx, -2.6, -10, 1.8, 2.6);
  ctx.fill();
  ellipse(ctx, 2.6, -10, 1.8, 2.6);
  ctx.fill();
  ctx.strokeStyle = "rgba(220,245,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, -4, 22, 22, 0, Math.PI * 1.15, Math.PI * 1.45);
  ctx.stroke();
  ctx.fillStyle = "rgba(120,170,200,0.5)";
  ellipse(ctx, 0, -4, 22, 4);
  ctx.fill();
  // Hatch underneath glows while beaming.
  ctx.fillStyle = state.beamOn ? "#c8fff0" : "#4d6a78";
  ellipse(ctx, 0, 13, 13, 3.5);
  ctx.fill();
  rimLights(ctx, view, true);
  ctx.restore();
}

function drawFloats(ctx: CanvasRenderingContext2D, view: View) {
  ctx.save();
  ctx.font = "700 18px Sora, system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const f of view.floats) {
    const t = f.age / 1.2;
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.fillStyle = "#fff4d6";
    ctx.fillText(f.text, f.x, f.y - (view.reducedMotion ? 0 : t * 30));
  }
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, state: GameState, view: View) {
  const light = skyLight(state);
  drawSky(ctx, state, view, light);
  drawPlace(ctx, state, light);
  const held = state.entities.filter((e) => e.state === "held" || e.state === "fall");
  for (const e of state.entities) if (!held.includes(e)) drawEntity(ctx, state, e, view);
  drawBeam(ctx, state, view);
  for (const e of held) drawEntity(ctx, state, e, view);
  drawSaucer(ctx, state, view);
  drawFloats(ctx, view);
}
