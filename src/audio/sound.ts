import { assetUrl, worldAssets } from '../config/assets';
import type { WorldId } from '../state/types';

/**
 * 効果音と環境音。素材がない間は Web Audio で合成する。
 * worldAssets に ambient を指定すると、そのワールドではループ音源を流す。
 * ブラウザの自動再生制限があるため、最初の操作で enable() されるまで鳴らさない。
 */
const PREF_KEY = 'taiwa:sound';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: { stop: () => void } | null = null;
  private world: WorldId = 'campfire';
  private missing = new Set<string>();
  private music: GainNode | null = null;
  private bgm: HTMLAudioElement | null = null;
  enabled = readPref();
  /** BGM と効果音の音量（0..1）。人ごとに覚えておく */
  musicVolume = readNum('taiwa:vol:music', 0.8);
  sfxVolume = readNum('taiwa:vol:sfx', 0.8);

  setMusicVolume(v: number) {
    this.musicVolume = v;
    writeNum('taiwa:vol:music', v);
    if (this.music) this.music.gain.value = v;
    if (this.bgm) this.bgm.volume = BGM_LEVEL * v;
  }

  setSfxVolume(v: number) {
    this.sfxVolume = v;
    writeNum('taiwa:vol:sfx', v);
    if (this.master) this.master.gain.value = 0.5 * v;
  }

  constructor() {
    // 前回「音あり」だった人は、最初に画面に触れた瞬間から鳴らす（自動再生の制限のため）
    if (this.enabled && typeof window !== 'undefined') {
      const wake = () => {
        window.removeEventListener('pointerdown', wake);
        void this.ensure()?.resume();
        this.startAmbient(this.world);
      };
      window.addEventListener('pointerdown', wake);
    }
  }

  /**
   * 素材の効果音を鳴らす。無ければ false を返すので、呼び出し側で合成音に切りかえる。
   */
  sample(world: WorldId, name: string, volume = 0.7): boolean {
    if (!this.enabled) return true;
    const file = worldAssets[world].sfx?.[name];
    if (!file || this.missing.has(file)) return false;
    const audio = new Audio(assetUrl(file));
    audio.volume = Math.min(1, volume * this.sfxVolume);
    audio.addEventListener('error', () => this.missing.add(file));
    void audio.play().catch(() => undefined);
    return true;
  }

  private ensure() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5 * this.sfxVolume;
    this.master.connect(this.ctx.destination);
    // 合成の環境音は BGM の音量に従う
    this.music = this.ctx.createGain();
    this.music.gain.value = this.musicVolume;
    this.music.connect(this.ctx.destination);
    return this.ctx;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem(PREF_KEY, on ? '1' : '0');
    } catch {
      /* 保存できなくても鳴らす */
    }
    if (on) {
      void this.ensure()?.resume();
      this.startAmbient(this.world);
    } else {
      this.ambient?.stop();
      this.ambient = null;
    }
  }

  setWorld(world: WorldId) {
    this.world = world;
    if (this.enabled) this.startAmbient(world);
  }

  private noise(ctx: AudioContext, seconds: number) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private startAmbient(world: WorldId) {
    this.ambient?.stop();
    this.ambient = null;
    const file = worldAssets[world].ambient;
    if (file) {
      const audio = new Audio(assetUrl(file));
      audio.loop = true;
      audio.volume = 0;
      // 素材が置かれていなければ、合成音に切りかえる
      audio.addEventListener('error', () => {
        if (this.world === world && this.enabled) this.startSynth(world);
      });
      void audio.play().catch(() => undefined);
      // ふわっと入って、ふわっと消える
      this.bgm = audio;
      const fadeIn = fade(audio, BGM_LEVEL * this.musicVolume, 1800);
      this.ambient = {
        stop: () => {
          if (this.bgm === audio) this.bgm = null;
          fadeIn();
          fade(audio, 0, 900, () => audio.pause());
        },
      };
      return;
    }
    this.startSynth(world);
  }

  private startSynth(world: WorldId) {
    this.ambient?.stop();
    const ctx = this.ensure();
    if (!ctx || !this.music) return;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2);
    out.connect(this.music);

    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx, 4);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    const bed = ctx.createGain();
    if (world === 'campfire' || world === 'bbq') {
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      bed.gain.value = 0.05;
    } else if (world === 'lantern') {
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.6;
      bed.gain.value = 0.035;
    } else {
      filter.type = 'bandpass';
      filter.frequency.value = 400;
      filter.Q.value = 0.4;
      bed.gain.value = 0.06;
    }
    src.connect(filter).connect(bed).connect(out);
    src.start();

    // 焚き火のパチパチ、虫の声、風のうねり
    const timer = window.setInterval(() => {
      if ((world === 'campfire' || world === 'bbq') && Math.random() < 0.7) this.crackle(out);
      if (world === 'nagori' || world === 'minasoko' || world === 'town') {
        const t = ctx.currentTime;
        bed.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.06, t + 1.5);
        if (Math.random() < 0.08) this.tone(out, 2400 + Math.random() * 800, 0.08, 0.03, 'sine');
      }
      // 灯籠祭は、湖の水音と遠くの虫の声だけ（ちえさんの作品の音はネタバレになるので使わない）
      if (world === 'lantern' && Math.random() < 0.05) this.tone(out, 3200 + Math.random() * 600, 0.06, 0.02, 'sine');
    }, 260);

    this.ambient = {
      stop: () => {
        window.clearInterval(timer);
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.linearRampToValueAtTime(0, t + 0.8);
        src.stop(t + 0.9);
      },
    };
  }

  private crackle(out: AudioNode) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + Math.random() * 0.2;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx, 0.05);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1500 + Math.random() * 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15 * Math.random(), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(f).connect(g).connect(out);
    src.start(t);
  }

  private tone(out: AudioNode, freq: number, dur: number, vol: number, type: OscillatorType = 'sine', at = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** 風鈴。番号ごとに音の高さが違う */
  chime(index = 0, out?: AudioNode, volume = 1) {
    if (!this.enabled || !this.ensure() || !this.master) return;
    const base = [1568, 1760, 2093, 2349][index % 4];
    const dest = out ?? this.master;
    this.tone(dest, base, 2.6, 0.12 * volume);
    this.tone(dest, base * 2.76, 1.4, 0.04 * volume);
    this.tone(dest, base * 5.4, 0.6, 0.015 * volume);
  }

  /** やわらかい鈴の音（お題が変わったとき） */
  bell() {
    if (!this.enabled || !this.ensure() || !this.master) return;
    this.tone(this.master, 880, 1.6, 0.08);
    this.tone(this.master, 1320, 1.2, 0.04, 'sine', 0.08);
  }

  /** ぽん、という小さな音（リアクション） */
  pop(pitch = 1) {
    if (!this.enabled || !this.ensure() || !this.master) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(520 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(980 * pitch, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }

  /** リアクションの音。どのワールドでも同じ（灯籠祭の音にそろえる） */
  reaction(id: 'empathy' | 'more' | 'speak' | 'other') {
    this.pop(id === 'speak' ? 1.3 : 1);
  }

  /** 遠くの花火 */
  boom() {
    if (!this.enabled || !this.ensure() || !this.master) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.25;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx, 1.2);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  /** 移動のときの、すっと吸い込まれる音 */
  whoosh() {
    if (!this.enabled || !this.ensure() || !this.master) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx, 1.6);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2200, t + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
}

/** 音量をなめらかに変える。止める関数を返す */
function fade(audio: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = audio.volume;
  const start = performance.now();
  let stopped = false;
  const step = (now: number) => {
    if (stopped) return;
    const k = Math.max(0, Math.min(1, (now - start) / ms));
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
  return () => {
    stopped = true;
  };
}

const BGM_LEVEL = 0.55;

function readNum(key: string, fallback: number) {
  try {
    const v = Number(localStorage.getItem(key));
    return localStorage.getItem(key) !== null && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
  } catch {
    return fallback;
  }
}

function writeNum(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* 覚えられなくても音量は変わる */
  }
}

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) === '1';
  } catch {
    return false;
  }
}

export const sound = new SoundEngine();
