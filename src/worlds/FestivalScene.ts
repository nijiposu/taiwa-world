import type { ReactionId } from '../state/types';
import { assetUrl } from '../config/assets';
import { coverPoint, coverRect } from '../engine/cover';
import { Scene, flicker, rand, stepParticles, type Particle } from '../engine/Scene';
import { PLATE_H, PLATE_W, buildLanterns, type MovingLantern } from './FestivalLanterns';

/** 湖の灯籠が昇る間隔と、昇るのにかける時間 */
const RISE_PERIOD = 5 * 60_000;
const RISE_SECONDS = 22;
/** 銀河鉄道が夜空を走る間隔と、走る時間 */
const TRAIN_PERIOD = 3 * 60_000;
const TRAIN_SECONDS = 34;
/** 奏音さんの列車の絵（920×135）の中の、先頭と煙突の位置と、絵の中での傾き */
const TRAIN_HEAD = { u: 0.985, v: 0.48 };
const TRAIN_CHIMNEY = { u: 0.938, v: 0.06 };
const TRAIN_BASE_ANGLE = Math.atan2(-42, 880);

/**
 * 確かめる用：URL に ?demo=1 を付けると、銀河鉄道と昇る灯籠を待たずにすぐ見られる。
 * （開いた瞬間から数えて、鉄道は1分ごと、灯籠は40秒ごと）
 */
const DEMO = typeof location !== 'undefined' && (new URLSearchParams(location.search).has('demo') || new URLSearchParams(location.search).has('try'));
const OPENED = Date.now();
function clockFor(period: number, demoPeriod: number) {
  return DEMO ? ((Date.now() - OPENED) % demoPeriod) + 0 : Date.now() % period;
}

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
 * ちえさんの作品の仕掛け（灯籠を流す・おみくじ・花火・風鈴）はネタバレになるので使わない。
 * 絵に描かれている灯籠は、そのまま切り出して、空ではふわりと浮き沈みし、湖ではゆらゆら漂う。
 * あとは星のまたたき、流れ星、湖のきらめきと波紋、夕日、水面をすべる霧で、絵を呼吸させる。
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
  private plate: HTMLCanvasElement | null = null;
  private lanterns: MovingLantern[] = [];

  constructor(canvas: HTMLCanvasElement, src?: string) {
    super(canvas);
    this.drawBackdrop = false;
    if (src) {
      const img = new Image();
      img.onload = () => {
        const built = buildLanterns(img);
        this.plate = built.plate;
        this.lanterns = built.lanterns;
      };
      img.src = src;
    }
  }

  /** 灯籠のない絵を敷き、その上に灯籠を少しずつ動かして描く */
  private drawLanterns() {
    if (!this.plate) return;
    const { ctx, t } = this;
    const r = coverRect(this.w, this.h, FESTIVAL_ASPECT);
    const k = r.w / PLATE_W;
    ctx.drawImage(this.plate, r.x, r.y, r.w, r.h);
    // 5分に1回、湖の灯籠が一つ、ふわりと空へ昇っていく（時計で決めるので全員同じ）
    const now = Date.now();
    const waters = this.lanterns.filter((l) => l.water);
    const riser = waters[Math.floor((DEMO ? now - OPENED : now) / (DEMO ? 40_000 : RISE_PERIOD)) % waters.length];
    const riseT = clockFor(RISE_PERIOD, 40_000) / 1000;
    for (const l of this.lanterns) {
      const a = t * l.speed + l.phase;
      let dx = l.water ? Math.sin(a * 0.5) * l.amp * 1.8 : Math.sin(a * 1.7) * l.amp * 0.35;
      let dy = l.water ? Math.sin(a) * l.amp * 0.5 : -l.amp * (0.5 - 0.5 * Math.cos(a));
      const rot = l.water ? Math.sin(a * 0.8) * 0.03 : Math.sin(a * 1.3) * 0.05;
      let alpha = 1;
      let scale = 1;
      if (l === riser && riseT < RISE_SECONDS + 4) {
        if (riseT < RISE_SECONDS) {
          // 水面から離れ、揺れながら昇り、遠ざかって小さくなる
          const e = riseT / RISE_SECONDS;
          const ease = e * e * (3 - 2 * e);
          dy -= ease * PLATE_H * 0.5;
          dx += Math.sin(riseT * 0.9) * 14 + ease * 60;
          scale = 1 - ease * 0.55;
          alpha = e > 0.8 ? 1 - (e - 0.8) / 0.2 : 1;
          if (riseT < 1.5 && Math.random() < 0.2) {
            const q = { x: r.x + (l.x + l.w / 2) * k, y: r.y + (l.y + l.h) * k };
            this.rings.push({ x: q.x, y: q.y, r: 6, life: 1.4, hue: 38 });
          }
        } else {
          // 空へ消えたあと、もとの場所にそっと灯りがもどる
          alpha = (riseT - RISE_SECONDS) / 4;
        }
      }
      const cx = r.x + (l.x + l.w / 2 + dx) * k;
      const cy = r.y + (l.y + l.h / 2 + dy) * k;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.drawImage(l.sprite, (-l.w / 2) * k, (-l.h / 2) * k, l.w * k, l.h * k);
      ctx.restore();
      if (alpha < 0.05) continue;
      // ほのかな灯りのゆらぎ
      const glow = 0.12 + flicker(t * 0.9, l.phase) * 0.06;
      const gr = Math.max(l.w, l.h) * k * 0.9;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
      g.addColorStop(0, `rgba(255,200,120,${glow})`);
      g.addColorStop(1, 'rgba(255,160,70,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
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

    this.drawLanterns();
    this.drawTrain();

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

  private trainSmoke: Particle[] = [];
  private trainImg: HTMLImageElement | null = (() => {
    const img = new Image();
    img.onload = () => (this.trainImg = img);
    img.src = assetUrl('assets/lantern/train.webp');
    return null;
  })();

  /**
   * 銀河鉄道。3分に1回、地平線の向こうから天の川へ向かって夜空をのぼっていく。
   * 列車は奏音さんの絵から切り出したもの。黒い煙をたなびかせる。時計で決めるので、部屋の全員が同じときに見る。
   */
  private drawTrain() {
    const { ctx } = this;
    const s = this.s;
    const phase = clockFor(TRAIN_PERIOD, 60_000) / 1000;
    const running = phase < TRAIN_SECONDS;
    const dt = 1 / 60;
    // 道すじ：左の地平線あたりから、天の川を斜めにのぼる
    const path = (e: number) => {
      // 奏音さんの絵のように、ほぼ水平に、少しずつのぼりながら空を横切る
      const a = this.p(-0.05, 0.3);
      const b = this.p(0.5, 0.2);
      const c = this.p(1.05, 0.12);
      const x = (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * b.x + e * e * c.x;
      const y = (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * b.y + e * e * c.y;
      return { x, y };
    };
    if (running && this.trainImg) {
      // 奏音さんの絵の列車（右が先頭）を、道すじの向きに合わせて走らせる
      const img = this.trainImg;
      const head = (phase / TRAIN_SECONDS) * 1.45;
      const p0 = path(head - 0.01);
      const p1 = path(head + 0.01);
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) - TRAIN_BASE_ANGLE;
      const q = path(head);
      const w = 600 * s * (1.05 - Math.min(1, head) * 0.25);
      const h = (w * img.height) / img.width;
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(ang);
      // 先頭（ライト）が q に来るように、絵の右端をそろえる
      ctx.drawImage(img, -w * TRAIN_HEAD.u, -h * TRAIN_HEAD.v, w, h);
      // ライトの光
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.12);
      lg.addColorStop(0, 'rgba(220,235,255,0.7)');
      lg.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(-w * 0.12, -w * 0.12, w * 0.24, w * 0.24);
      ctx.globalCompositeOperation = 'source-over';
      // 煙突の位置（絵の中の位置から計算）
      const cx = (TRAIN_CHIMNEY.u - TRAIN_HEAD.u) * w;
      const cy = (TRAIN_CHIMNEY.v - TRAIN_HEAD.v) * h;
      const m = ctx.getTransform();
      ctx.restore();
      const dpr = this.dpr;
      const sx = (m.a * cx + m.c * cy + m.e) / dpr;
      const sy = (m.b * cx + m.d * cy + m.f) / dpr;
      if (Math.random() < 0.7) {
        const max = rand(3.5, 5.5);
        const back = ang + TRAIN_BASE_ANGLE + Math.PI;
        this.trainSmoke.push({ x: sx, y: sy, vx: Math.cos(back) * rand(10, 22) * s, vy: Math.sin(back) * rand(10, 22) * s - rand(4, 10) * s, life: max, max, size: rand(7, 12) * s * (w / (600 * s)), hue: 0, seed: rand(0, 10) });
      }
      // 車輪のあたりからこぼれる星くず
      if (Math.random() < 0.6) {
        const t = Math.random();
        const tx = q.x - Math.cos(ang + TRAIN_BASE_ANGLE) * w * t * 0.95;
        const ty = q.y - Math.sin(ang + TRAIN_BASE_ANGLE) * w * t * 0.95 + h * 0.3;
        const max = rand(1.2, 2.4);
        this.glints.push({ x: tx, y: ty, vx: 0, vy: 0, life: max, max, size: rand(3, 7) * s, hue: rand(40, 60), seed: 0 });
      }
    }
    for (const p of this.trainSmoke) {
      const k = 1 - p.life / p.max;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // 奏音さんの絵のような、もくもくした黒い煙
      ctx.fillStyle = `rgba(16,16,34,${0.42 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + k * 2.6), 0, Math.PI * 2);
      ctx.fill();
    }
    stepParticles(this.trainSmoke, dt);
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
