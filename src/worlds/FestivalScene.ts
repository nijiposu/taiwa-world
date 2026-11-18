import type { Keepsake, ReactionId } from '../state/types';
import { coverPoint, coverRect } from '../engine/cover';
import { Scene, clamp, flicker, rand, stepParticles, type Particle } from '../engine/Scene';

/** ちえさんの灯籠祭の絵の中の位置。0..1 */
export const FESTIVAL_ASPECT = 1672 / 941;
const HORIZON = 0.555;
const TORII = { u: 0.5, v: 0.53 };
const SUN = { u: 0.5, v: 0.545 };
/** 水面に浮かぶ灯籠（絵に描かれているもの） */
export const WATER_LANTERNS: [number, number, number][] = [
  // u, v, 大きさ
  [0.064, 0.62, 1], [0.198, 0.625, 1], [0.91, 0.685, 1.7], [0.82, 0.615, 0.9], [0.655, 0.61, 0.8],
  [0.69, 0.6, 0.7], [0.762, 0.6, 0.6], [0.23, 0.59, 0.6], [0.28, 0.59, 0.6], [0.022, 0.58, 0.5],
  [0.07, 0.58, 0.5], [0.97, 0.59, 0.6], [0.12, 0.578, 0.5], [0.16, 0.578, 0.5], [0.6, 0.588, 0.5],
];
/** 流した灯籠が、飛び石のわきから鳥居へ向かう道すじ */
const DRIFT_FROM = { u: 0.42, v: 0.86 };
const DRIFT_TO = { u: 0.505, v: 0.572 };
const PALETTE = [8, 22, 38, 48, 330, 280, 195];

interface Rocket {
  x: number;
  y: number;
  vy: number;
  ty: number;
  hue: number;
  size: number;
  trail: { x: number; y: number }[];
}

interface SkyLantern {
  x: number;
  y: number;
  vy: number;
  size: number;
  seed: number;
  life: number;
}

interface Drifter {
  id: string;
  text: string;
  k: number;
  rise: number;
  seed: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  life: number;
}

/**
 * 灯籠祭：星空と夕焼けの湖、鳥居、浮かぶ灯籠の絵に重ねる演出。
 * 空へ昇る灯籠、湖に映る花火、水面のきらめきと波紋。流した灯籠は鳥居まで流れて、空へ昇る。
 */
export class FestivalScene extends Scene {
  private rockets: Rocket[] = [];
  private sparks: Particle[] = [];
  private glints: Particle[] = [];
  private sky: SkyLantern[] = [];
  private drifters: Drifter[] = [];
  private rings: Ring[] = [];
  private known = new Set<string>();
  private pulse = WATER_LANTERNS.map(() => 0);
  private seeds = WATER_LANTERNS.map(() => rand(0, 10));
  private toriiGlow = 0;
  private flash = 0;
  private nextRocket = 3;
  private nextStar = 6;
  private skyAcc = 0;
  private stars: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.drawBackdrop = false;
  }

  protected paintBackdrop() {}

  private p(u: number, v: number) {
    return coverPoint(this.w, this.h, FESTIVAL_ASPECT, u, v);
  }

  private get s() {
    return coverRect(this.w, this.h, FESTIVAL_ASPECT).w / 1600;
  }

  private get waterY() {
    return this.p(0, HORIZON).y;
  }

  /** みんなが流した灯籠を、湖に浮かべる */
  syncLanterns(list: Keepsake[]) {
    for (const k of list) {
      if (this.known.has(k.id)) continue;
      this.known.add(k.id);
      // 前から流れていた灯籠は、もう空に昇ったことにする
      if (Date.now() - k.at > 8000) continue;
      this.drifters.push({ id: k.id, text: k.text, k: 0, rise: 0, seed: rand(0, 10) });
    }
  }

  protected frame(dt: number) {
    const { ctx, t, w } = this;
    const s = this.s;
    const wy = this.waterY;
    ctx.globalCompositeOperation = 'lighter';

    // ── 夕日と鳥居のあかり ──
    this.toriiGlow = Math.max(0, this.toriiGlow - dt * 0.6);
    const sun = this.p(SUN.u, SUN.v);
    const R = (260 + flicker(t * 0.5) * 20 + this.toriiGlow * 220) * s;
    const g = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, R);
    g.addColorStop(0, `rgba(255,200,120,${0.22 + this.toriiGlow * 0.35})`);
    g.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sun.x - R, sun.y - R, R * 2, R * 2);

    // 花火の光で、空と湖がほのかに明るくなる
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,190,170,${this.flash * 0.06})`;
      ctx.fillRect(0, 0, w, this.h);
      this.flash = Math.max(0, this.flash - dt * 1.2);
    }

    // ── 水面の灯籠がゆらぐ ──
    WATER_LANTERNS.forEach(([u, v, size], i) => {
      this.pulse[i] = Math.max(0, this.pulse[i] - dt * 0.7);
      const q = this.p(u, v);
      const k = 0.7 + flicker(t * 0.9, this.seeds[i]) * 0.2 + this.pulse[i] * 1.4;
      const r = (34 + this.pulse[i] * 60) * s * size;
      const lg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      lg.addColorStop(0, `rgba(255,214,140,${0.4 * k})`);
      lg.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
      // 揺れる映り込み
      for (let j = 0; j < 4; j++) {
        const ww = (14 - j * 2) * s * size + Math.sin(t * 3 + j + i) * 2;
        ctx.fillStyle = `rgba(255,190,110,${0.12 * k})`;
        ctx.fillRect(q.x - ww / 2, q.y + (12 + j * 9) * s * size, ww, 2 * s * size);
      }
    });

    // ── 夕日の映り込みにきらめき ──
    if (Math.random() < dt * 14 * this.density) {
      const v = rand(HORIZON + 0.01, 0.98);
      const spread = 0.02 + (v - HORIZON) * 0.12;
      const q = this.p(SUN.u + rand(-spread, spread), v);
      const max = rand(0.4, 1.1);
      this.glints.push({ x: q.x, y: q.y, vx: 0, vy: 0, life: max, max, size: rand(6, 18) * s * (0.5 + (v - HORIZON) * 2), hue: 38, seed: 0 });
    }
    if (Math.random() < dt * 6 * this.density) {
      const q = this.p(rand(0, 1), rand(HORIZON + 0.02, 0.98));
      const max = rand(0.5, 1.2);
      this.glints.push({ x: q.x, y: q.y, vx: 0, vy: 0, life: max, max, size: rand(5, 12) * s, hue: rand(250, 290), seed: 0 });
    }
    for (const gl of this.glints) {
      const a = Math.sin((gl.life / gl.max) * Math.PI);
      ctx.fillStyle = `hsla(${gl.hue},90%,78%,${a * 0.5})`;
      ctx.fillRect(gl.x - gl.size / 2, gl.y, gl.size, 1.4);
    }
    stepParticles(this.glints, dt);

    // ── 波紋 ──
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      r.r += dt * 60 * s;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = `rgba(255,230,190,${r.life * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── 空へ昇る灯籠（絶えず少しずつ） ──
    this.skyAcc += dt * 0.9 * this.density;
    while (this.skyAcc > 1) {
      this.skyAcc -= 1;
      const q = this.p(rand(0.38, 0.72), rand(0.38, 0.5));
      this.sky.push({ x: q.x, y: q.y, vy: rand(6, 14) * s, size: rand(2, 5) * s, seed: rand(0, 10), life: rand(14, 22) });
    }
    for (let i = this.sky.length - 1; i >= 0; i--) {
      const l = this.sky[i];
      l.life -= dt;
      l.y -= l.vy * dt;
      l.x += Math.sin(t * 0.5 + l.seed) * 4 * dt + 3 * dt;
      l.size += dt * 0.05 * s;
      if (l.life <= 0 || l.y < -20) {
        this.sky.splice(i, 1);
        continue;
      }
      this.drawSkyLantern(l.x, l.y, l.size, Math.min(1, l.life / 3), l.seed);
    }

    // ── 花火 ──
    this.nextRocket -= dt;
    if (this.nextRocket <= 0) {
      this.launch();
      if (Math.random() > 0.7) window.setTimeout(() => this.launch(), 400);
      this.nextRocket = rand(5, 11);
    }
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.trail.push({ x: r.x, y: r.y });
      if (r.trail.length > 10) r.trail.shift();
      r.y += r.vy * dt;
      r.vy *= 1 - dt * 0.5;
      ctx.strokeStyle = `hsla(${r.hue},90%,75%,0.55)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      r.trail.forEach((pt, j) => (j ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
      ctx.stroke();
      if (r.y <= r.ty || r.vy > -60) {
        this.explode(r);
        this.rockets.splice(i, 1);
      }
    }
    for (const p of this.sparks) {
      const k = 1 - p.life / p.max;
      p.vx *= 1 - dt * 1.6;
      p.vy = p.vy * (1 - dt * 1.6) + 60 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = (1 - k) * (k > 0.6 ? 0.5 + 0.5 * Math.sin(t * 30 + p.seed * 9) : 1);
      ctx.fillStyle = `hsla(${p.hue},95%,65%,${a * 0.25})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${p.hue},100%,${80 - k * 20}%,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // 湖に映る
      if (p.y < wy) {
        const ry = wy + (wy - p.y) * 0.45;
        if (ry < this.h) {
          ctx.fillStyle = `hsla(${p.hue},90%,65%,${a * 0.14})`;
          ctx.fillRect(p.x - 3, ry, 6, 1.4);
        }
      }
    }
    stepParticles(this.sparks, dt);

    // ── 流れ星（天の川にそって） ──
    this.nextStar -= dt;
    if (this.nextStar <= 0) {
      this.shootingStar();
      this.nextStar = rand(8, 16);
    }
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const st = this.stars[i];
      st.life -= dt;
      if (st.life <= 0) {
        this.stars.splice(i, 1);
        continue;
      }
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      const a = Math.min(1, st.life * 2);
      const lg = ctx.createLinearGradient(st.x, st.y, st.x - st.vx * 0.2, st.y - st.vy * 0.2);
      lg.addColorStop(0, `rgba(255,250,235,${a})`);
      lg.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.strokeStyle = lg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x - st.vx * 0.2, st.y - st.vy * 0.2);
      ctx.stroke();
    }

    // ── 流した灯籠：鳥居まで流れて、空へ昇る ──
    for (let i = this.drifters.length - 1; i >= 0; i--) {
      const d = this.drifters[i];
      if (d.k < 1) d.k = Math.min(1, d.k + dt / 14);
      else d.rise += dt;
      const e = 1 - Math.pow(1 - d.k, 1.6);
      const a = this.p(DRIFT_FROM.u, DRIFT_FROM.v);
      const b = this.p(DRIFT_TO.u, DRIFT_TO.v);
      let x = a.x + (b.x - a.x) * e + Math.sin(t * 0.8 + d.seed) * 6 * (1 - e) * s;
      let y = a.y + (b.y - a.y) * e + Math.sin(t * 1.3 + d.seed) * 2 * s;
      let size = (34 * (1 - e) + 5) * s;
      let alpha = 1;
      if (d.rise > 0) {
        x += Math.sin(t * 0.7 + d.seed) * 10 * s + d.rise * 6 * s;
        y -= d.rise * d.rise * 6 * s + d.rise * 16 * s;
        size = 5 * s + d.rise * 0.3 * s;
        alpha = clamp(1 - d.rise / 18, 0, 1);
        if (alpha <= 0) {
          this.drifters.splice(i, 1);
          continue;
        }
        this.drawSkyLantern(x, y, size, alpha, d.seed);
      } else {
        this.drawWaterLantern(x, y, size);
        if (Math.random() < dt * 2) this.rings.push({ x, y: y + size * 0.15, r: size * 0.6, life: 1 });
      }
      if (d.text) {
        const fade = d.rise > 0 ? alpha * 0.8 : Math.min(1, d.k * 6);
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = `${Math.round(14 + 6 * (1 - e))}px "Zen Old Mincho", serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,240,215,${fade})`;
        ctx.shadowColor = 'rgba(255,150,80,0.9)';
        ctx.shadowBlur = 12;
        ctx.fillText(d.text, x, y - size * 1.4 - 10);
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'lighter';
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawSkyLantern(x: number, y: number, size: number, alpha: number, seed: number) {
    const { ctx, t } = this;
    const k = (0.8 + flicker(t, seed) * 0.15) * alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, size * 5);
    g.addColorStop(0, `rgba(255,200,120,${0.45 * k})`);
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - size * 5, y - size * 5, size * 10, size * 10);
    ctx.fillStyle = `rgba(255,224,160,${0.95 * k})`;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.8, y - size);
    ctx.lineTo(x + size * 0.8, y - size);
    ctx.lineTo(x + size * 0.55, y + size);
    ctx.lineTo(x - size * 0.55, y + size);
    ctx.closePath();
    ctx.fill();
  }

  private drawWaterLantern(x: number, y: number, size: number) {
    const { ctx, t } = this;
    const k = 0.85 + Math.sin(t * 3) * 0.1;
    const g = ctx.createRadialGradient(x, y - size * 0.5, 0, x, y - size * 0.5, size * 3);
    g.addColorStop(0, `rgba(255,200,120,${0.5 * k})`);
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - size * 3, y - size * 3.5, size * 6, size * 6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#3a2216';
    ctx.fillRect(x - size * 0.7, y - size * 0.08, size * 1.4, size * 0.16);
    const paper = ctx.createLinearGradient(x - size / 2, 0, x + size / 2, 0);
    paper.addColorStop(0, `rgba(255,190,110,${k})`);
    paper.addColorStop(0.5, `rgba(255,240,200,${k})`);
    paper.addColorStop(1, `rgba(255,190,110,${k})`);
    ctx.fillStyle = paper;
    ctx.fillRect(x - size / 2, y - size, size, size * 0.92);
    ctx.globalCompositeOperation = 'lighter';
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = `rgba(255,200,120,${0.25 * k})`;
      ctx.fillRect(x - size * (0.45 - j * 0.08), y + size * (0.2 + j * 0.3), size * (0.9 - j * 0.16), size * 0.08);
    }
  }

  launch(x?: number, ty?: number, hue?: number, size = 1) {
    const s = this.s;
    const q = this.p(rand(0.2, 0.8), HORIZON);
    this.rockets.push({
      x: x ?? q.x,
      y: this.waterY,
      vy: -rand(520, 640) * Math.max(0.7, s),
      ty: ty ?? this.p(0, rand(0.08, 0.3)).y,
      hue: hue ?? PALETTE[Math.floor(Math.random() * PALETTE.length)],
      size,
      trail: [],
    });
  }

  private explode(r: Rocket) {
    const n = Math.round((70 + Math.random() * 50) * this.density * r.size + 20);
    const ring = Math.random() > 0.6;
    const speed = rand(140, 220) * r.size * Math.max(0.7, Math.min(1.3, this.s));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05);
      const v = ring ? speed : speed * Math.sqrt(Math.random());
      const max = rand(1.4, 2.4);
      this.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max, size: rand(1.2, 2.2), hue: r.hue + rand(-12, 12), seed: rand(0, 10) });
    }
    this.flash = Math.min(1, this.flash + 0.35 * r.size);
  }

  shootingStar() {
    const q = this.p(rand(0.25, 0.5), rand(0.02, 0.15));
    this.stars.push({ x: q.x, y: q.y, vx: -rand(260, 380), vy: rand(220, 300), life: 1 });
  }

  /** 鳥居に触れる：夕日が強まり、水面の灯籠が奥から手前へ順に灯る */
  torii() {
    this.toriiGlow = 1;
    const order = WATER_LANTERNS.map((l, i) => [l[1], i] as const).sort((a, b) => a[0] - b[0]);
    order.forEach(([, i], k) => window.setTimeout(() => (this.pulse[i] = 1), k * 120));
    const q = this.p(TORII.u, TORII.v);
    for (let i = 0; i < 4; i++) window.setTimeout(() => this.rings.push({ x: q.x, y: this.p(0, 0.575).y, r: 10, life: 1.6 }), i * 300);
  }

  /** 水面の灯籠に触れる：そこから一つ、空へ昇る */
  release(i: number) {
    this.pulse[i] = 1;
    const [u, v, size] = WATER_LANTERNS[i];
    const q = this.p(u, v);
    this.sky.push({ x: q.x, y: q.y - 20 * this.s * size, vy: rand(26, 40) * this.s, size: 6 * this.s * size, seed: rand(0, 10), life: 16 });
    this.rings.push({ x: q.x, y: q.y + 6 * this.s * size, r: 12 * this.s * size, life: 1.4 });
  }

  ripple(x: number, y: number) {
    for (let i = 0; i < 3; i++) window.setTimeout(() => this.rings.push({ x, y, r: 4, life: 1.4 }), i * 180);
  }

  /** たくさんの灯籠が、いっせいに空へ */
  flock(count = 14) {
    for (let i = 0; i < count; i++) {
      const q = this.p(rand(0.3, 0.75), rand(0.5, 0.62));
      this.sky.push({ x: q.x, y: q.y, vy: rand(22, 40) * this.s, size: rand(3, 6) * this.s, seed: rand(0, 10), life: rand(12, 18) });
    }
  }

  reaction(id: ReactionId) {
    switch (id) {
      case 'empathy':
        this.launch(undefined, undefined, 18, 0.9);
        break;
      case 'more':
        this.flock(16);
        break;
      case 'speak':
        this.launch(this.p(0.5, 0).x, this.p(0, 0.16).y, 200, 1.5);
        this.torii();
        break;
      case 'other':
        this.launch(undefined, undefined, 130, 1);
        break;
    }
  }

  pointer(x: number, y: number, kind: 'move' | 'down'): string | void {
    if (kind !== 'down') return;
    const s = this.s;
    const torii = this.p(TORII.u, TORII.v);
    if (Math.abs(x - torii.x) < 70 * s && Math.abs(y - torii.y) < 60 * s) return 'torii';
    for (let i = 0; i < WATER_LANTERNS.length; i++) {
      const [u, v, size] = WATER_LANTERNS[i];
      const q = this.p(u, v);
      if (Math.hypot(x - q.x, y - q.y) < 32 * s * size + 10) return `lantern:${i}`;
    }
    return y < this.waterY ? 'sky' : 'water';
  }
}
