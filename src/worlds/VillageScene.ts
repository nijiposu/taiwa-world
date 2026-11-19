import type { ReactionId } from '../state/types';
import { coverPoint, coverRect } from '../engine/cover';
import { Scene, flicker, rand, stepParticles, type Particle } from '../engine/Scene';

/** ナゴリの樹・根もとの村の絵の中の位置（0..1） */
export const VILLAGE_ASPECT = 1672 / 941;
export const FIRE = { u: 0.565, v: 0.6 };
const MOON = { u: 0.915, v: 0.115 };
const CHIMNEY = { u: 0.165, v: 0.3 };
export const VILLAGE_LANTERNS: [number, number][] = [
  [0.32, 0.13], [0.165, 0.215], [0.175, 0.25], [0.26, 0.265], [0.325, 0.325],
  [0.67, 0.185], [0.69, 0.155], [0.775, 0.235], [0.815, 0.275], [0.67, 0.375],
];
/** 樹の家・小屋の窓。対話が深まる（リアクションや言葉の葉が増える）ほど、順に明るく灯る */
export const VILLAGE_WINDOWS: [number, number][] = [
  [0.385, 0.205], [0.52, 0.175], [0.615, 0.22], [0.45, 0.295], [0.515, 0.325],
  [0.075, 0.505], [0.23, 0.495], [0.175, 0.5], [0.47, 0.49], [0.78, 0.47],
];
export const SPOTS = {
  stump: { u: 0.325, v: 0.5, r: 0.05 },
  door: { u: 0.47, v: 0.49, r: 0.035 },
  cellar: { u: 0.695, v: 0.79, r: 0.06 },
  library: { u: 0.82, v: 0.5, r: 0.09 },
  cottage: { u: 0.16, v: 0.49, r: 0.09 },
  moon: { u: 0.915, v: 0.115, r: 0.035 },
};
export type SpotName = keyof typeof SPOTS;

interface Pulse {
  u: number;
  v: number;
  r: number;
  life: number;
  hue: number;
}

/**
 * ナゴリの樹・根もとの村に重ねる演出。
 * 焚き火と鍋の湯気、煙突の煙、ランタンのゆらぎ、舞う葉と花びら、ほたる、月のあかり。
 * 樹の窓は、場があたたまるほど一つずつ灯っていく。
 */
export class VillageScene extends Scene {
  private flames: Particle[] = [];
  private embers: Particle[] = [];
  private sparks: Particle[] = [];
  private steam: Particle[] = [];
  private smoke: Particle[] = [];
  private leaves: Particle[] = [];
  private flies: Particle[] = [];
  private pages: Particle[] = [];
  private pulses: Pulse[] = [];
  private lanternPulse = VILLAGE_LANTERNS.map(() => 0);
  private lanternSeed = VILLAGE_LANTERNS.map(() => rand(0, 10));
  private windowGlow = VILLAGE_WINDOWS.map(() => 0);
  private lit = 0;
  private boost = 0;
  private wind = 0;
  private acc = { flame: 0, ember: 0, steam: 0, smoke: 0, leaf: 0 };
  private px = -1;
  private py = -1;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.drawBackdrop = false;
  }

  protected paintBackdrop() {}

  private p(u: number, v: number) {
    return coverPoint(this.w, this.h, VILLAGE_ASPECT, u, v);
  }

  private get s() {
    return coverRect(this.w, this.h, VILLAGE_ASPECT).w / 1600;
  }

  protected layout() {
    if (this.flies.length) return;
    for (let i = 0; i < 26; i++) this.flies.push(this.firefly());
  }

  private firefly(): Particle {
    const q = this.p(rand(0.02, 0.98), rand(0.35, 0.95));
    return { x: q.x, y: q.y, vx: 0, vy: 0, life: 1e9, max: 1e9, size: rand(1.2, 2.4), hue: rand(50, 90), seed: rand(0, 100) };
  }

  /** 窓に灯す数（場のあたたまり具合） */
  setLight(n: number) {
    this.lit = Math.max(0, Math.min(VILLAGE_WINDOWS.length, n));
  }

  protected frame(dt: number) {
    const { ctx, t } = this;
    const s = this.s;
    this.boost = Math.max(0, this.boost - dt * 0.7);
    this.wind = Math.max(0, this.wind - dt * 0.4);
    const fire = this.p(FIRE.u, FIRE.v);
    const f = flicker(t);

    ctx.globalCompositeOperation = 'lighter';

    // ── 月 ──
    const moon = this.p(MOON.u, MOON.v);
    const mr = 90 * s * (1 + Math.sin(t * 0.3) * 0.05);
    const mg = ctx.createRadialGradient(moon.x, moon.y, 0, moon.x, moon.y, mr);
    mg.addColorStop(0, 'rgba(240,235,255,0.22)');
    mg.addColorStop(1, 'rgba(240,235,255,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(moon.x - mr, moon.y - mr, mr * 2, mr * 2);

    // ── 焚き火のあかり ──
    const R = (300 + f * 20 + this.boost * 120) * s;
    const glow = ctx.createRadialGradient(fire.x, fire.y, 6 * s, fire.x, fire.y, R);
    glow.addColorStop(0, `rgba(255,170,80,${0.24 * (1 + f * 0.15 + this.boost * 0.5)})`);
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(fire.x - R, fire.y - R, R * 2, R * 2);

    // ── 窓（灯った数だけ、あたたかく光る） ──
    VILLAGE_WINDOWS.forEach(([u, v], i) => {
      const target = i < this.lit ? 1 : 0;
      this.windowGlow[i] += (target - this.windowGlow[i]) * dt * 1.2;
      const k = this.windowGlow[i];
      if (k < 0.02) return;
      const q = this.p(u, v);
      const r = 46 * s * (0.8 + k * 0.4);
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      g.addColorStop(0, `rgba(255,214,140,${0.45 * k * (0.85 + flicker(t * 0.7, i) * 0.15)})`);
      g.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
    });

    // ── ランタン ──
    VILLAGE_LANTERNS.forEach(([u, v], i) => {
      this.lanternPulse[i] = Math.max(0, this.lanternPulse[i] - dt * 0.8);
      const q = this.p(u, v);
      const k = 0.7 + flicker(t * 0.8, this.lanternSeed[i]) * 0.2 + this.lanternPulse[i] * 1.4;
      const r = (38 + this.lanternPulse[i] * 60) * s;
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      g.addColorStop(0, `rgba(255,214,130,${0.4 * k})`);
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
    });

    // ── 炎と火の粉 ──
    this.acc.flame += dt * (50 + this.boost * 90);
    while (this.acc.flame > 1) {
      this.acc.flame -= 1;
      const max = rand(0.4, 0.8) * (1 + this.boost * 0.4);
      this.flames.push({ x: fire.x + rand(-12, 12) * s, y: fire.y + 6 * s, vx: rand(-4, 4), vy: -rand(50, 90) * s * (1 + this.boost * 0.3), life: max, max, size: rand(9, 15) * s, hue: 0, seed: rand(0, 10) });
    }
    for (const p of this.flames) {
      const k = 1 - p.life / p.max;
      p.x += (p.vx + Math.sin(t * 3 + p.seed) * 6 + (fire.x - p.x) * 1.6) * dt;
      p.y += p.vy * dt;
      const size = p.size * (1 - k * 0.8);
      const hue = 46 - k * 38;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
      g.addColorStop(0, `hsla(${hue},100%,${66 - k * 25}%,${(1 - k) * 0.38})`);
      g.addColorStop(1, `hsla(${hue - 10},100%,40%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    stepParticles(this.flames, dt);
    this.acc.ember += dt * (4 + this.boost * 20) * this.density;
    while (this.acc.ember > 1) {
      this.acc.ember -= 1;
      const max = rand(1.6, 3.2);
      this.embers.push({ x: fire.x + rand(-10, 10) * s, y: fire.y - 10 * s, vx: rand(-14, 14), vy: -rand(30, 70) * s, life: max, max, size: rand(0.8, 1.8), hue: rand(20, 45), seed: rand(0, 10) });
    }
    this.drawSparks(this.embers, dt, -3);
    this.drawSparks(this.sparks, dt, 40);

    // ── ほたる（指先に寄ってくる） ──
    for (const fl of this.flies) {
      fl.seed += dt;
      let tx = Math.cos(fl.seed * 0.37) * 14;
      let ty = Math.sin(fl.seed * 0.51) * 9;
      if (this.px >= 0) {
        const dx = this.px - fl.x;
        const dy = this.py - fl.y;
        const d = Math.hypot(dx, dy);
        if (d < 220 && d > 8) {
          tx += (dx / d) * 22;
          ty += (dy / d) * 22;
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

    // ── 触れたところの光の輪 ──
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pu = this.pulses[i];
      pu.life -= dt;
      if (pu.life <= 0) {
        this.pulses.splice(i, 1);
        continue;
      }
      const q = this.p(pu.u, pu.v);
      const r = pu.r * this.w * (1.4 - pu.life * 0.4);
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      g.addColorStop(0, `hsla(${pu.hue},100%,75%,${pu.life * 0.35})`);
      g.addColorStop(1, `hsla(${pu.hue},100%,60%,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';

    // ── 鍋の湯気・煙突の煙 ──
    this.acc.steam += dt * 3;
    while (this.acc.steam > 1) {
      this.acc.steam -= 1;
      const q = this.p(FIRE.u, FIRE.v - 0.045);
      const max = rand(2.5, 4);
      this.steam.push({ x: q.x + rand(-6, 6) * s, y: q.y, vx: rand(-4, 4), vy: -rand(14, 24) * s, life: max, max, size: rand(8, 14) * s, hue: 0, seed: rand(0, 10) });
    }
    this.acc.smoke += dt * 1.6;
    while (this.acc.smoke > 1) {
      this.acc.smoke -= 1;
      const q = this.p(CHIMNEY.u, CHIMNEY.v);
      const max = rand(4, 7);
      this.smoke.push({ x: q.x, y: q.y, vx: rand(4, 10), vy: -rand(10, 18) * s, life: max, max, size: rand(10, 16) * s, hue: 0, seed: rand(0, 10) });
    }
    for (const list of [this.steam, this.smoke]) {
      for (const p of list) {
        const k = 1 - p.life / p.max;
        p.x += (p.vx + Math.sin(t + p.seed) * 6 + this.wind * 30) * dt;
        p.y += p.vy * dt;
        ctx.fillStyle = `rgba(235,228,245,${0.12 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + k * 1.8), 0, Math.PI * 2);
        ctx.fill();
      }
      stepParticles(list, dt);
    }

    // ── 舞う葉と花びら ──
    this.acc.leaf += dt * (0.9 + this.wind * 5) * this.density;
    while (this.acc.leaf > 1) {
      this.acc.leaf -= 1;
      this.dropLeaf();
    }
    for (const l of this.leaves) {
      l.x += (l.vx + Math.sin(t * 1.4 + l.seed) * 24 + this.wind * 70) * dt;
      l.y += (l.vy + Math.cos(t + l.seed) * 6) * dt;
      const a = Math.min(1, l.life * 1.2);
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(t * 2 + l.seed);
      ctx.fillStyle = l.hue < 0 ? `rgba(255,248,236,${a * 0.95})` : `hsla(${l.hue},50%,${l.light ?? 42}%,${a})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.size, l.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    stepParticles(this.leaves, dt);

    // ── 書庫から舞い出るページ：ひらひら裏返りながら、金色の光の粒をこぼして昇る ──
    for (const pg of this.pages) {
      pg.vy += -4 * dt;
      pg.x += (pg.vx + Math.sin(t * 1.6 + pg.seed) * 26) * dt;
      pg.y += pg.vy * dt;
      const a = Math.min(1, pg.life / 1.2, (pg.max - pg.life) * 3);
      const flip = Math.cos(t * 2.4 + pg.seed * 3);
      const w = pg.size;
      const h = pg.size * 1.32;
      ctx.save();
      ctx.translate(pg.x, pg.y);
      ctx.rotate(Math.sin(t * 1.2 + pg.seed) * 0.5);
      ctx.scale(Math.max(0.08, Math.abs(flip)), 1);
      ctx.shadowColor = 'rgba(255,200,120,0.6)';
      ctx.shadowBlur = 10;
      const g = ctx.createLinearGradient(-w, 0, w, 0);
      const face = flip > 0;
      g.addColorStop(0, face ? `rgba(236,222,190,${a})` : `rgba(214,196,160,${a})`);
      g.addColorStop(0.5, face ? `rgba(255,250,236,${a})` : `rgba(232,218,188,${a})`);
      g.addColorStop(1, face ? `rgba(240,228,200,${a})` : `rgba(206,188,150,${a})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-w, -h);
      ctx.lineTo(w * 0.7, -h);
      ctx.quadraticCurveTo(w, -h, w, -h * 0.7);
      ctx.lineTo(w, h);
      ctx.lineTo(-w, h);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      if (face) {
        ctx.fillStyle = `rgba(110,85,60,${a * 0.45})`;
        for (let i = 0; i < 6; i++) ctx.fillRect(-w * 0.72, -h * 0.65 + i * h * 0.24, w * (i % 3 === 2 ? 0.9 : 1.44), Math.max(0.8, w * 0.06));
      }
      ctx.restore();
      if (Math.random() < dt * 10) {
        const max = rand(0.8, 1.4);
        this.sparks.push({ x: pg.x, y: pg.y + h, vx: rand(-8, 8), vy: rand(10, 24), life: max, max, size: rand(0.8, 1.5), hue: 45, seed: rand(0, 10) });
      }
    }
    stepParticles(this.pages, dt);
  }

  private dropLeaf(petal = Math.random() < 0.3) {
    const q = this.p(rand(0.02, 0.95), rand(0, 0.2));
    const max = rand(6, 10);
    this.leaves.push({ x: q.x, y: q.y, vx: rand(-8, 14), vy: rand(16, 34), life: max, max, size: rand(4, 7) * (petal ? 0.7 : 1), hue: petal ? -1 : rand(70, 110), light: rand(32, 50), seed: rand(0, 10) });
  }

  private drawSparks(list: Particle[], dt: number, gravity: number) {
    const { ctx, t } = this;
    for (const p of list) {
      const k = 1 - p.life / p.max;
      p.vx *= 1 - dt * 0.8;
      p.vy += gravity * dt;
      p.x += (p.vx + Math.sin(t * 2 + p.seed) * 10) * dt;
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

  private burst(u: number, v: number, hue: number, count: number, speed = 1) {
    const q = this.p(u, v);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 160) * speed * this.s * 1.4;
      const max = rand(1, 2.2);
      this.sparks.push({ x: q.x, y: q.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: max, max, size: rand(1, 2.4), hue: hue + rand(-12, 12), seed: rand(0, 10) });
    }
  }

  // ───────── 外から呼ぶ演出 ─────────

  poke() {
    this.boost = Math.min(2, this.boost + 0.9);
    this.burst(FIRE.u, FIRE.v - 0.03, 32, 34, 1.1);
  }

  lantern(i: number) {
    this.lanternPulse[i] = 1;
    const [u, v] = VILLAGE_LANTERNS[i];
    this.burst(u, v, 44, 14, 0.5);
  }

  touch(spot: SpotName) {
    const sp = SPOTS[spot];
    if (spot === 'stump') {
      this.burst(sp.u, sp.v - 0.03, 110, 26, 0.8);
      this.pulses.push({ u: sp.u, v: sp.v - 0.03, r: 0.05, life: 1.2, hue: 110 });
    } else if (spot === 'library') {
      const q = this.p(sp.u, sp.v);
      for (let i = 0; i < 6; i++) {
        const max = rand(3.5, 5);
        this.pages.push({ x: q.x + rand(-50, 50) * this.s, y: q.y + rand(-10, 20) * this.s, vx: rand(-24, 24), vy: -rand(18, 34), life: max, max, size: rand(11, 15) * this.s, hue: 0, seed: rand(0, 10) });
      }
      this.pulses.push({ u: sp.u, v: sp.v, r: 0.07, life: 1.2, hue: 40 });
    } else if (spot === 'cellar') {
      this.pulses.push({ u: sp.u, v: sp.v, r: 0.06, life: 1.6, hue: 200 });
      this.burst(sp.u, sp.v - 0.02, 200, 24, 0.6);
    } else if (spot === 'moon') {
      this.pulses.push({ u: sp.u, v: sp.v, r: 0.06, life: 1.6, hue: 260 });
      this.wind = 1;
    } else {
      this.pulses.push({ u: sp.u, v: sp.v, r: 0.05, life: 1.2, hue: 40 });
      this.burst(sp.u, sp.v, 40, 14, 0.5);
    }
  }

  gust() {
    this.wind = 1;
    for (let i = 0; i < 20; i++) this.dropLeaf(Math.random() < 0.4);
  }

  reaction(id: ReactionId) {
    switch (id) {
      case 'empathy':
        this.boost = Math.min(2, this.boost + 0.6);
        this.burst(FIRE.u, FIRE.v - 0.03, 20, 30, 1);
        break;
      case 'more':
        VILLAGE_LANTERNS.forEach((_, i) => window.setTimeout(() => (this.lanternPulse[i] = 0.9), i * 90));
        break;
      case 'speak':
        this.boost = Math.min(2, this.boost + 1.2);
        this.burst(FIRE.u, FIRE.v - 0.03, 200, 50, 1.3);
        break;
      case 'other':
        this.gust();
        break;
    }
  }

  pointer(x: number, y: number, kind: 'move' | 'down'): string | void {
    if (kind === 'move') {
      this.px = x;
      this.py = y;
      return;
    }
    const r = coverRect(this.w, this.h, VILLAGE_ASPECT);
    const u = (x - r.x) / r.w;
    const v = (y - r.y) / r.h;
    const near = (a: { u: number; v: number }, rad: number) => Math.hypot(u - a.u, (v - a.v) * 0.56) < rad;
    if (near(FIRE, 0.04)) return 'fire';
    for (let i = 0; i < VILLAGE_LANTERNS.length; i++) {
      if (near({ u: VILLAGE_LANTERNS[i][0], v: VILLAGE_LANTERNS[i][1] }, 0.02)) return `lantern:${i}`;
    }
    for (const name of Object.keys(SPOTS) as SpotName[]) if (near(SPOTS[name], SPOTS[name].r)) return `spot:${name}`;
    return v < 0.25 ? 'canopy' : 'ground';
  }
}
