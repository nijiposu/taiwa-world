import type { ReactionId } from '../state/types';
import { coverPoint, coverRect } from '../engine/cover';
import { Scene, clamp, flicker, rand, stepParticles, type Particle } from '../engine/Scene';

/** 絵（ナゴリの樹・森の広場）の中の位置。0..1 */
export const HEARTH_ASPECT = 2400 / 1351;
export const FIRE = { u: 0.515, v: 0.655 };
export const LANTERNS: [number, number][] = [
  [0.195, 0.12], [0.115, 0.24], [0.245, 0.19], [0.38, 0.04], [0.525, 0.075], [0.61, 0.235],
  [0.715, 0.19], [0.765, 0.14], [0.845, 0.13], [0.92, 0.28], [0.19, 0.44], [0.70, 0.465], [0.91, 0.51],
];
/** 夜空がのぞいている所（流れ星が通る） */
const SKY = { u0: 0.3, u1: 0.62, v0: 0.12, v1: 0.42 };

interface Spiral {
  a: number;
  r: number;
  y: number;
  vy: number;
  hue: number;
  life: number;
}

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/**
 * 焚き火の色。20秒ごとに次の色へ、ゆっくり移り変わる。
 * 時計で決めるので、部屋の全員の画面で同じ色になる。
 * 値は、ふつうの橙色からの色相のずれ（度）
 */
const FIRE_TINTS = [0, 175, 95, 245, 300, 30];
const TINT_PERIOD = 20_000;

const REACTION_HUE: Record<ReactionId, number> = { empathy: 22, more: 48, speak: 200, other: 115 };

/**
 * 森の広場の絵に重ねる演出。
 * 絵の焚き火に本物の炎と火の粉を足し、ランタンを揺らし、ほたるとほこりを漂わせる。
 * 「説明のかわりに演出」：どこに触れても、何かが起きる。
 */
export class HearthScene extends Scene {
  private flames: Particle[] = [];
  private embers: Particle[] = [];
  private sparks: Particle[] = [];
  private flies: Particle[] = [];
  private dust: Particle[] = [];
  private fog: Particle[] = [];
  private leaves: Particle[] = [];
  private spirals: Spiral[] = [];
  private stars: Star[] = [];
  private lanternPulse = LANTERNS.map(() => 0);
  private lanternSeed = LANTERNS.map(() => rand(0, 10));
  private boost = 0;
  private flameAcc = 0;
  private emberAcc = 0;
  private gustT = 0;
  private swarm: { x: number; y: number; t: number } | null = null;
  private px = -1;
  private py = -1;
  private tint = FIRE_TINTS[Math.floor(Date.now() / TINT_PERIOD) % FIRE_TINTS.length];

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.drawBackdrop = false;
  }

  protected paintBackdrop() {}

  private p(u: number, v: number) {
    return coverPoint(this.w, this.h, HEARTH_ASPECT, u, v);
  }

  /** 絵の 1600px 幅を基準にした大きさの倍率 */
  private get s() {
    return coverRect(this.w, this.h, HEARTH_ASPECT).w / 1600;
  }

  protected layout() {
    if (this.flies.length) return;
    for (let i = 0; i < 34; i++) this.flies.push(this.firefly());
    for (let i = 0; i < 70 * this.density; i++) this.dust.push(this.mote(true));
    for (let i = 0; i < 7; i++) this.fog.push(this.fogBank(true));
  }

  private firefly(): Particle {
    const q = this.p(rand(0.05, 0.95), rand(0.15, 0.8));
    return { x: q.x, y: q.y, vx: rand(-10, 10), vy: rand(-6, 6), life: 1e9, max: 1e9, size: rand(1.2, 2.4), hue: rand(48, 80), seed: rand(0, 100) };
  }

  private mote(anywhere = false): Particle {
    const max = rand(10, 22);
    return { x: rand(0, this.w), y: anywhere ? rand(0, this.h) : this.h + 5, vx: rand(-4, 4), vy: -rand(3, 10), life: anywhere ? rand(0, max) : max, max, size: rand(0.6, 1.5), hue: 40, seed: rand(0, 100) };
  }

  private fogBank(anywhere = false): Particle {
    const q = this.p(anywhere ? rand(0, 1) : -0.2, rand(0.72, 0.98));
    return { x: q.x, y: q.y, vx: rand(6, 14), vy: 0, life: 1e9, max: 1e9, size: rand(160, 300), hue: 0, seed: rand(0, 100) };
  }

  protected frame(dt: number) {
    const { ctx, t } = this;
    const s = this.s;
    const fire = this.p(FIRE.u, FIRE.v);
    this.boost = Math.max(0, this.boost - dt * 0.7);
    this.gustT = Math.max(0, this.gustT - dt);
    const f = flicker(t);
    // 焚き火の色を、目標の色へなめらかに寄せる（色相は近い向きに回す）
    const goal = FIRE_TINTS[Math.floor(Date.now() / TINT_PERIOD) % FIRE_TINTS.length];
    let diff = ((goal - this.tint + 540) % 360) - 180;
    if (Math.abs(diff) < 0.5) diff = 0;
    this.tint = (this.tint + diff * Math.min(1, dt * 0.6) + 360) % 360;
    const tint = this.tint;
    // 橙色から離れているほど、絵の炎に負けないよう濃く描く
    const colored = Math.min(1, Math.abs(((tint + 180) % 360) - 180) / 60);
    const heat = 1 + f * 0.14 + this.boost * 0.55;

    // ── 低い霧 ──
    for (const g of this.fog) {
      g.x += g.vx * dt * (1 + this.gustT);
      if (g.x - g.size > this.w) Object.assign(g, this.fogBank());
      const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.size * s);
      grad.addColorStop(0, 'rgba(200,190,230,0.07)');
      grad.addColorStop(1, 'rgba(200,190,230,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(g.x - g.size * s, g.y - g.size * s, g.size * 2 * s, g.size * 2 * s);
    }

    ctx.globalCompositeOperation = 'lighter';

    // ── 焚き火が地面と木を照らす ──
    const R = (520 + f * 30 + this.boost * 160) * s;
    const glow = ctx.createRadialGradient(fire.x, fire.y, 10 * s, fire.x, fire.y, R);
    glow.addColorStop(0, `hsla(${30 + tint},100%,66%,${0.26 * heat})`);
    glow.addColorStop(0.4, `hsla(${22 + tint},80%,53%,${0.08 * heat})`);
    glow.addColorStop(1, `hsla(${18 + tint},85%,26%,0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(fire.x - R, fire.y - R, R * 2, R * 2);

    // ── ランタン ──
    LANTERNS.forEach(([u, v], i) => {
      const q = this.p(u, v);
      this.lanternPulse[i] = Math.max(0, this.lanternPulse[i] - dt * 0.8);
      const k = 0.75 + flicker(t * 0.8, this.lanternSeed[i]) * 0.18 + this.lanternPulse[i] * 1.3;
      const r = (46 + this.lanternPulse[i] * 70) * s;
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      g.addColorStop(0, `rgba(255,214,130,${0.42 * k})`);
      g.addColorStop(0.35, `rgba(255,170,70,${0.14 * k})`);
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
    });

    // ── 炎 ──
    this.flameAcc += dt * (70 + this.boost * 140) * (this.reducedMotion ? 0.5 : 1);
    while (this.flameAcc > 1) {
      this.flameAcc -= 1;
      const max = rand(0.5, 1) * (1 + this.boost * 0.5);
      this.flames.push({ x: fire.x + rand(-26, 26) * s * rand(0.3, 1), y: fire.y - 18 * s, vx: rand(-6, 6), vy: -rand(70, 120) * s * (1 + this.boost * 0.32), life: max, max, size: rand(14, 24) * s * (1 + this.boost * 0.15 + colored * 0.25), hue: 0, seed: rand(0, 10) });
    }
    for (const p of this.flames) {
      const k = 1 - p.life / p.max;
      p.x += (p.vx + Math.sin(t * 3 + p.seed) * 10 + (fire.x - p.x) * 1.6) * dt;
      p.y += p.vy * dt;
      const size = p.size * (1 - k * 0.8);
      const hue = 46 - k * 38 + tint;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
      g.addColorStop(0, `hsla(${hue},100%,${66 - k * 25}%,${(1 - k) * 0.36 * (1 + colored * 0.7)})`);
      g.addColorStop(1, `hsla(${hue - 10},100%,40%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    stepParticles(this.flames, dt);

    // ── 火の粉 ──
    this.emberAcc += dt * (6 + this.boost * 26) * this.density;
    while (this.emberAcc > 1) {
      this.emberAcc -= 1;
      const max = rand(2, 4.5);
      this.embers.push({ x: fire.x + rand(-20, 20) * s, y: fire.y - 30 * s, vx: rand(-20, 20), vy: -rand(40, 95) * s, life: max, max, size: rand(0.9, 2.2), hue: rand(20, 45) + tint, seed: rand(0, 10) });
    }
    this.drawSparkList(this.embers, dt, -4);
    this.drawSparkList(this.sparks, dt, 55);

    // ── 問いが生まれるときの、らせん ──
    for (let i = this.spirals.length - 1; i >= 0; i--) {
      const sp = this.spirals[i];
      sp.life -= dt;
      sp.a += dt * 5;
      sp.y -= sp.vy * dt;
      sp.r += dt * 18 * s;
      if (sp.life <= 0) {
        this.burstAt(fire.x + Math.cos(sp.a) * sp.r, fire.y + sp.y, 6, sp.hue, 0.6);
        this.spirals.splice(i, 1);
        continue;
      }
      const x = fire.x + Math.cos(sp.a) * sp.r;
      const y = fire.y + sp.y + Math.sin(sp.a) * sp.r * 0.25;
      ctx.fillStyle = `hsla(${sp.hue},100%,75%,0.9)`;
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${sp.hue},100%,65%,0.25)`;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── ほたる（指先に寄ってくる） ──
    for (const fl of this.flies) {
      fl.seed += dt;
      let tx = Math.cos(fl.seed * 0.37) * 14;
      let ty = Math.sin(fl.seed * 0.51) * 9;
      const target = this.swarm ?? (this.px >= 0 ? { x: this.px, y: this.py, t: 1 } : null);
      if (target) {
        const dx = target.x - fl.x;
        const dy = target.y - fl.y;
        const d = Math.hypot(dx, dy);
        const reach = this.swarm ? 2000 : 220;
        if (d < reach && d > 8) {
          tx += (dx / d) * (this.swarm ? 70 : 22);
          ty += (dy / d) * (this.swarm ? 70 : 22);
        }
      }
      fl.vx += (tx - fl.vx) * dt * 1.5;
      fl.vy += (ty - fl.vy) * dt * 1.5;
      fl.x += fl.vx * dt;
      fl.y += fl.vy * dt;
      if (fl.x < -20 || fl.x > this.w + 20 || fl.y < -20 || fl.y > this.h + 20) Object.assign(fl, this.firefly());
      const a = Math.max(0, Math.sin(fl.seed * 1.7)) ** 2 * 0.9 + 0.05;
      ctx.fillStyle = `hsla(${fl.hue},90%,65%,${a * 0.22})`;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.size * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${fl.hue},100%,85%,${a})`;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.size, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.swarm) {
      this.swarm.t -= dt;
      if (this.swarm.t <= 0) this.swarm = null;
    }

    // ── 漂うほこり（焚き火の近くほど光る） ──
    for (const d of this.dust) {
      d.life -= dt;
      if (d.life <= 0) Object.assign(d, this.mote());
      d.x += (d.vx + Math.sin(t * 0.4 + d.seed) * 6 + this.gustT * 60) * dt;
      d.y += d.vy * dt;
      const near = clamp(1 - Math.hypot(d.x - fire.x, d.y - fire.y) / (600 * s), 0, 1);
      const a = Math.min(1, d.life / 3, (d.max - d.life) / 3) * (0.15 + near * 0.6);
      ctx.fillStyle = `rgba(255,${200 + near * 40},${150 + near * 50},${a})`;
      ctx.fillRect(d.x, d.y, d.size, d.size);
    }

    // ── 流れ星 ──
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
      const g = ctx.createLinearGradient(st.x, st.y, st.x - st.vx * 0.2, st.y - st.vy * 0.2);
      g.addColorStop(0, `rgba(255,250,235,${a})`);
      g.addColorStop(1, 'rgba(255,250,235,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x - st.vx * 0.2, st.y - st.vy * 0.2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // ── 舞う葉と花びら ──
    for (const l of this.leaves) {
      l.x += (l.vx + Math.sin(t * 1.4 + l.seed) * 30 + this.gustT * 120) * dt;
      l.y += (l.vy + Math.cos(t + l.seed) * 8) * dt;
      const a = Math.min(1, l.life * 1.5);
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(t * 2 + l.seed);
      ctx.fillStyle = l.hue < 0 ? `rgba(255,236,240,${a * 0.9})` : `hsla(${l.hue},55%,${l.light ?? 42}%,${a})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.size, l.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    stepParticles(this.leaves, dt);

    // ── 画面のふちを、息をするように暗く ──
    const breathe = 0.5 + Math.sin(t * 0.35) * 0.06;
    const v = ctx.createRadialGradient(this.w / 2, this.h * 0.55, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h * 0.55, Math.max(this.w, this.h) * 0.8);
    v.addColorStop(0, 'rgba(8,6,16,0)');
    v.addColorStop(1, `rgba(8,6,16,${breathe})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawSparkList(list: Particle[], dt: number, gravity: number) {
    const { ctx, t } = this;
    for (const p of list) {
      const k = 1 - p.life / p.max;
      p.vx += Math.sin(t * 2 + p.seed) * 26 * dt + this.gustT * 40 * dt;
      p.vx *= 1 - dt * 0.8;
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = (1 - k) * (0.6 + 0.4 * Math.sin(t * 22 + p.seed * 7));
      ctx.fillStyle = `hsla(${p.hue},100%,62%,${a * 0.28})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${p.hue},100%,${p.light ?? 80}%,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    stepParticles(list, dt);
  }

  private burstAt(x: number, y: number, count: number, hue: number, speed = 1, spread = Math.PI * 2, base = 0) {
    for (let i = 0; i < count; i++) {
      const a = base + rand(-spread / 2, spread / 2);
      const v = rand(60, 220) * speed;
      const max = rand(1.2, 2.8);
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max, size: rand(1.1, 2.6), hue: hue + rand(-12, 12), seed: rand(0, 10) });
    }
  }

  private fireBurst(count: number, hue: () => number, speed = 1) {
    const q = this.p(FIRE.u, FIRE.v - 0.03);
    for (let i = 0; i < count; i++) this.burstAt(q.x + rand(-10, 10), q.y, 1, hue(), speed * this.s * 1.4, Math.PI * 0.9, -Math.PI / 2);
  }

  // ───────── 外から呼ぶ演出 ─────────

  /** 焚き火をつつく。続けてつつくほど大きくなる */
  poke(level: number) {
    this.boost = Math.min(2.4, this.boost + 0.6 + level * 0.25);
    this.fireBurst(18 + level * 14, () => rand(15, 48), 1 + level * 0.15);
    if (level >= 4) {
      // 火柱と、火の粉の輪
      const q = this.p(FIRE.u, FIRE.v - 0.04);
      this.burstAt(q.x, q.y, 70, 38, 1.8 * this.s * 1.4);
      for (let i = 0; i < 24; i++) this.spirals.push({ a: (i / 24) * Math.PI * 2, r: 10, y: -20, vy: rand(140, 220) * this.s, hue: rand(20, 50), life: rand(1.2, 1.8) });
    }
  }

  /** 問いが火から生まれる */
  spiral(hue = 42) {
    for (let i = 0; i < 26; i++) this.spirals.push({ a: (i / 26) * Math.PI * 4, r: 8 + i * 0.6, y: -20 - i * 3, vy: rand(90, 130) * this.s, hue: hue + rand(-10, 10), life: 1.6 + i * 0.03 });
    this.boost = Math.min(2.4, this.boost + 0.8);
  }

  lantern(i: number) {
    this.lanternPulse[i] = 1;
    const [u, v] = LANTERNS[i];
    const q = this.p(u, v);
    this.burstAt(q.x, q.y, 20, 42, 0.5);
  }

  /** ランタンが端から順に灯る */
  lanternWave() {
    const order = LANTERNS.map((l, i) => [l[0], i] as const).sort((a, b) => a[0] - b[0]);
    order.forEach(([, i], k) => window.setTimeout(() => (this.lanternPulse[i] = 0.8), k * 140));
  }

  gust() {
    this.gustT = 2.5;
    for (let i = 0; i < 26 * this.density; i++) {
      const max = rand(4, 8);
      const petal = Math.random() < 0.35;
      this.leaves.push({ x: rand(-80, this.w * 0.3), y: rand(0, this.h * 0.6), vx: rand(40, 90), vy: rand(15, 40), life: max, max, size: rand(4, 8) * (petal ? 0.7 : 1), hue: petal ? -1 : rand(70, 110), light: rand(30, 50), seed: rand(0, 10) });
    }
  }

  /** ほたるが一か所に集まって、ふわっとほどける */
  swarmAt(u = rand(0.25, 0.75), v = rand(0.25, 0.55)) {
    const q = this.p(u, v);
    this.swarm = { x: q.x, y: q.y, t: 3.2 };
  }

  pop() {
    this.boost = Math.min(2.4, this.boost + 0.5);
    this.fireBurst(26, () => rand(18, 42), 1.3);
  }

  shootingStar(x?: number, y?: number) {
    const q = x === undefined || y === undefined ? this.p(rand(SKY.u0, SKY.u1), rand(SKY.v0, SKY.v1 - 0.15)) : { x, y };
    const dir = Math.random() > 0.5 ? 1 : -1;
    this.stars.push({ x: q.x, y: q.y, vx: dir * rand(380, 520), vy: rand(140, 220), life: 0.9 });
  }

  /** 地面に触れたとき：小さな光の輪 */
  ripple(x: number, y: number) {
    this.burstAt(x, y, 14, rand(40, 60), 0.45);
  }

  reaction(id: ReactionId) {
    const hue = REACTION_HUE[id];
    switch (id) {
      case 'empathy':
        this.boost = Math.min(2.4, this.boost + 0.7);
        this.fireBurst(40, () => rand(10, 30), 1.1);
        break;
      case 'more':
        this.fireBurst(30, () => rand(44, 56), 1.2);
        this.swarmAt(FIRE.u, FIRE.v - 0.2);
        break;
      case 'speak':
        this.boost = Math.min(2.4, this.boost + 1.4);
        this.fireBurst(60, () => rand(190, 215), 1.5);
        this.lanternWave();
        break;
      case 'other':
        this.fireBurst(36, () => rand(100, 140), 1.1);
        this.gust();
        break;
    }
    void hue;
  }

  /** 触れた場所に応じて、起きたことの名前を返す */
  pointer(x: number, y: number, kind: 'move' | 'down'): string | void {
    if (kind === 'move') {
      this.px = x;
      this.py = y;
      return;
    }
    const s = this.s;
    const fire = this.p(FIRE.u, FIRE.v - 0.04);
    if (Math.hypot(x - fire.x, (y - fire.y) * 1.3) < 95 * s) return 'fire';
    for (let i = 0; i < LANTERNS.length; i++) {
      const q = this.p(LANTERNS[i][0], LANTERNS[i][1]);
      if (Math.hypot(x - q.x, y - q.y) < 40 * s) return `lantern:${i}`;
    }
    const r = coverRect(this.w, this.h, HEARTH_ASPECT);
    const u = (x - r.x) / r.w;
    const v = (y - r.y) / r.h;
    if (u > SKY.u0 && u < SKY.u1 && v > SKY.v0 && v < SKY.v1) return 'sky';
    return 'ground';
  }
}
