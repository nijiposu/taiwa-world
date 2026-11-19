import type { ReactionId } from '../state/types';
import { coverPoint, coverRect } from '../engine/cover';
import { Scene, flicker, rand, stepParticles, type Particle } from '../engine/Scene';

/** ちえさんの灯籠祭の絵の中の位置。0..1 */
export const FESTIVAL_ASPECT = 1672 / 941;
const HORIZON = 0.555;
const TORII = { u: 0.5, v: 0.53 };
const SUN = { u: 0.5, v: 0.545 };
/** 天の川（流れ星が通る） */
const MILKY = { u0: 0.22, u1: 0.5, v0: 0.02, v1: 0.3 };

interface Ring {
  x: number;
  y: number;
  r: number;
  life: number;
  hue: number;
}

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface Twinkle {
  u: number;
  v: number;
  size: number;
  seed: number;
}

/**
 * 灯籠祭（ちえさんの世界）の絵に重ねる、静かな演出。
 * ちえさんの作品の仕掛け（灯籠・おみくじ・花火・風鈴）はネタバレになるので使わない。
 * 星のまたたき、流れ星、湖のきらめきと波紋、夕日、水面をすべる霧だけで、絵を呼吸させる。
 */
export class FestivalScene extends Scene {
  private glints: Particle[] = [];
  private mist: Particle[] = [];
  private rings: Ring[] = [];
  private stars: Star[] = [];
  private twinkles: Twinkle[] = [];
  private sunGlow = 0;
  private path = 0;
  private nextStar = 4;

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

  protected layout() {
    if (this.twinkles.length) return;
    for (let i = 0; i < 90; i++) this.twinkles.push({ u: rand(0, 1), v: Math.pow(Math.random(), 1.4) * 0.42, size: rand(0.6, 1.8), seed: rand(0, 100) });
    for (let i = 0; i < 6; i++) this.mist.push(this.mistBank(true));
  }

  private mistBank(anywhere = false): Particle {
    const q = this.p(anywhere ? rand(0, 1) : -0.25, rand(HORIZON - 0.03, HORIZON + 0.06));
    return { x: q.x, y: q.y, vx: rand(5, 11), vy: 0, life: 1e9, max: 1e9, size: rand(180, 320), hue: 0, seed: rand(0, 10) };
  }

  protected frame(dt: number) {
    const { ctx, t } = this;
    const s = this.s;
    const wy = this.waterY;

    // ── 水面をすべる霧 ──
    for (const m of this.mist) {
      m.x += m.vx * dt;
      if (m.x - m.size * s > this.w) Object.assign(m, this.mistBank());
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * s);
      g.addColorStop(0, 'rgba(230,200,240,0.08)');
      g.addColorStop(1, 'rgba(230,200,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(m.x - m.size * s, m.y - m.size * s * 0.4, m.size * 2 * s, m.size * 0.8 * s);
    }

    ctx.globalCompositeOperation = 'lighter';

    // ── 星のまたたき ──
    for (const tw of this.twinkles) {
      const q = this.p(tw.u, tw.v);
      const a = Math.max(0, Math.sin(t * (0.8 + (tw.seed % 2)) + tw.seed)) ** 3;
      ctx.fillStyle = `rgba(255,248,230,${a * 0.85})`;
      ctx.beginPath();
      ctx.arc(q.x, q.y, tw.size * (0.6 + a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 夕日と、鳥居から手前へのびる光の道 ──
    this.sunGlow = Math.max(0, this.sunGlow - dt * 0.5);
    this.path = Math.max(0, this.path - dt * 0.35);
    const sun = this.p(SUN.u, SUN.v);
    const R = (260 + flicker(t * 0.4) * 20 + this.sunGlow * 240) * s;
    const g = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, R);
    g.addColorStop(0, `rgba(255,200,120,${0.2 + this.sunGlow * 0.35})`);
    g.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sun.x - R, sun.y - R, R * 2, R * 2);
    if (this.path > 0) {
      const near = this.p(SUN.u, 1);
      const lg = ctx.createLinearGradient(0, wy, 0, near.y);
      lg.addColorStop(0, `rgba(255,210,140,${0.5 * this.path})`);
      lg.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(sun.x - 8 * s, wy);
      ctx.lineTo(sun.x + 8 * s, wy);
      ctx.lineTo(near.x + 160 * s, near.y);
      ctx.lineTo(near.x - 160 * s, near.y);
      ctx.fill();
    }

    // ── 湖のきらめき（夕日の映り込みに沿って） ──
    if (Math.random() < dt * 16 * this.density) {
      const v = rand(HORIZON + 0.01, 0.98);
      const spread = 0.02 + (v - HORIZON) * 0.12;
      const q = this.p(SUN.u + rand(-spread, spread), v);
      const max = rand(0.4, 1.1);
      this.glints.push({ x: q.x, y: q.y, vx: 0, vy: 0, life: max, max, size: rand(6, 18) * s * (0.5 + (v - HORIZON) * 2), hue: 38, seed: 0 });
    }
    if (Math.random() < dt * 7 * this.density) {
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
      ctx.strokeStyle = `hsla(${r.hue},80%,82%,${r.life * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── 流れ星（天の川にそって） ──
    this.nextStar -= dt;
    if (this.nextStar <= 0) {
      this.shootingStar();
      this.nextStar = rand(6, 13);
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
      // 湖にも映る
      const ry = wy + (wy - st.y) * 0.45;
      if (ry < this.h) {
        ctx.fillStyle = `rgba(255,250,235,${a * 0.18})`;
        ctx.fillRect(st.x - 6, ry, 12, 1.4);
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  shootingStar(x?: number, y?: number) {
    const q = x === undefined || y === undefined ? this.p(rand(MILKY.u0, MILKY.u1), rand(MILKY.v0, MILKY.v1 - 0.12)) : { x, y };
    this.stars.push({ x: q.x, y: q.y, vx: -rand(260, 380), vy: rand(200, 300), life: 1 });
  }

  /** 鳥居に触れる：夕日が強まり、湖に光の道がのびる */
  torii() {
    this.sunGlow = 1;
    this.path = 1;
    const q = this.p(TORII.u, 0.575);
    for (let i = 0; i < 4; i++) window.setTimeout(() => this.rings.push({ x: q.x, y: q.y, r: 10, life: 1.6, hue: 38 }), i * 300);
  }

  ripple(x: number, y: number, hue = 30) {
    for (let i = 0; i < 3; i++) window.setTimeout(() => this.rings.push({ x, y, r: 4, life: 1.4, hue }), i * 180);
    for (let i = 0; i < 8; i++) {
      const max = rand(0.5, 1.1);
      this.glints.push({ x: x + rand(-40, 40) * this.s, y: y + rand(-6, 10) * this.s, vx: 0, vy: 0, life: max, max, size: rand(6, 14) * this.s, hue: hue + 8, seed: 0 });
    }
  }

  /** 湖じゅうがきらめく */
  shimmer(hue: number, count = 60) {
    for (let i = 0; i < count; i++) {
      const q = this.p(rand(0, 1), rand(HORIZON + 0.02, 0.98));
      const max = rand(0.6, 1.6);
      this.glints.push({ x: q.x, y: q.y, vx: 0, vy: 0, life: max, max, size: rand(8, 20) * this.s, hue, seed: 0 });
    }
  }

  reaction(id: ReactionId) {
    switch (id) {
      case 'empathy':
        this.ripple(this.p(rand(0.3, 0.7), rand(0.65, 0.85)).x, this.p(0, rand(0.65, 0.85)).y, 25);
        this.sunGlow = Math.max(this.sunGlow, 0.5);
        break;
      case 'more':
        this.shootingStar();
        window.setTimeout(() => this.shootingStar(), 350);
        break;
      case 'speak':
        this.torii();
        break;
      case 'other':
        this.shimmer(170, 70);
        break;
    }
  }

  pointer(x: number, y: number, kind: 'move' | 'down'): string | void {
    if (kind !== 'down') return;
    const s = this.s;
    const torii = this.p(TORII.u, TORII.v);
    if (Math.abs(x - torii.x) < 70 * s && Math.abs(y - torii.y) < 60 * s) return 'torii';
    return y < this.waterY ? 'sky' : 'water';
  }
}
