/**
 * Synthesized sound: oscillators and noise from the Web Audio API, so there are no audio files
 * to license. Off until the player turns it on; the audio context starts on that tap, because
 * browsers need a user gesture before they'll play anything.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let hum: { osc: OscillatorNode; wob: OscillatorNode; gain: GainNode } | null = null;
let soundOn = false;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function setSoundOn(on: boolean) {
  soundOn = on;
  if (on) {
    const a = audio();
    if (a?.state === "suspended") void a.resume();
  } else {
    setHum(false);
  }
}

function tone(
  freq: number,
  start: number,
  length: number,
  type: OscillatorType,
  volume: number,
  slideTo?: number,
) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + length);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

export type Sfx =
  "lock" | "heavy" | "drop" | "collect-1" | "collect-2" | "collect-3" | "levelup" | "dawn";

export function play(sfx: Sfx) {
  if (!soundOn || document.visibilityState !== "visible") return;
  switch (sfx) {
    case "lock":
      tone(520, 0, 0.12, "sine", 0.15, 700);
      break;
    case "heavy":
      tone(110, 0, 0.35, "sawtooth", 0.08, 90);
      break;
    case "drop":
      tone(500, 0, 0.3, "triangle", 0.15, 160);
      break;
    case "collect-1":
      tone(660, 0, 0.12, "sine", 0.2);
      tone(990, 0.07, 0.16, "sine", 0.16);
      break;
    case "collect-2":
      tone(520, 0, 0.14, "sine", 0.2);
      tone(780, 0.08, 0.14, "sine", 0.18);
      tone(1040, 0.16, 0.22, "sine", 0.15);
      break;
    case "collect-3":
      [440, 554, 660, 880, 1108].forEach((f, i) => tone(f, i * 0.07, 0.25, "triangle", 0.16));
      break;
    case "levelup":
      [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.3, "square", 0.07));
      break;
    case "dawn":
      [784, 659, 523].forEach((f, i) => tone(f, i * 0.18, 0.5, "sine", 0.14));
      break;
  }
}

/** The beam's low hum, on while the beam is held. */
export function setHum(on: boolean) {
  const a = ctx;
  if (on && soundOn && a && master && !hum && document.visibilityState === "visible") {
    const osc = a.createOscillator();
    const wob = a.createOscillator();
    const wobGain = a.createGain();
    const gain = a.createGain();
    osc.type = "sine";
    osc.frequency.value = 150;
    wob.frequency.value = 7;
    wobGain.gain.value = 12;
    wob.connect(wobGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, a.currentTime + 0.08);
    osc.connect(gain).connect(master);
    osc.start();
    wob.start();
    hum = { osc, wob, gain };
  } else if (!on && hum && a) {
    const h = hum;
    hum = null;
    h.gain.gain.setTargetAtTime(0.0001, a.currentTime, 0.04);
    h.osc.stop(a.currentTime + 0.2);
    h.wob.stop(a.currentTime + 0.2);
  }
}
