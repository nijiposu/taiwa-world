import type { ReactionId } from '../state/types';
import { Scene, clamp, drawStars, rand, seeded, stepParticles, type Particle } from '../engine/Scene';

export interface TreeLayout {
  baseX: number;
  baseY: number;
  trunkTop: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** 樹の位置関係。キャンバスと、葉に残した言葉（DOM）で共有する */
export function treeLayout(w: number, h: number): TreeLayout {
  const baseX = w * 0.5;
  const baseY = h * 0.8;
  const rx = Math.min(w * 0.4, h * 0.44);
  const ry = rx * 0.56;
  const trunkTop = baseY - Math.min(h * 0.34, rx * 0.9);
  return { baseX, baseY, trunkTop, cx: baseX, cy: trunkTop - ry * 0.3, rx, ry };
}

/** 正規化座標(0..1)を樹冠の楕円の中の点にする */
export function canopyPoint(l: TreeLayout, u: number, v: number) {
  const a = u * Math.PI * 2;
  const r = Math.sqrt(v) * 0.86;
  return { x: l.cx + Math.cos(a) * l.rx * r, y: l.cy + Math.sin(a) * l.ry * r * 0.9 };
}

/** 言葉の葉を置く位置。お題カードに隠れないよう、樹冠の中ほどから下に寄せる */
export function leafPoint(l: TreeLayout, u: number, v: number) {
  let dx = (u - 0.5) * 1.6;
  let dy = v * 1.1 - 0.3;
  const d = Math.hypot(dx, dy);
  if (d > 0.85) {
    dx *= 0.85 / d;
    dy *= 0.85 / d;
  }
  return { x: l.cx + dx * l.rx, y: l.cy + dy * l.ry };
}

interface Blob {
  x: number;
  y: number;
  r: number;
  tone: number;
  phase: number;
}

interface Root {
  pts: { x: number; y: number }[];
}

interface Pulse {
  root: number;
  p: number;
  speed: number;
  hue: number;
}

interface Spirit {
  x: number;
  y: number;
  size: number;
  hop: number;
  vy: number;
  blink: number;
  look: number;
}

interface Riser {
  x: number;
  y: number;
  tx: number;
  ty: number;
  k: number;
  hue: number;
}

const TONES = ['#123528', '#1a4a37', '#24664a', '#3a875c', '#62ad79'];

/** 色の明るさを変える（#rrggbb 用） */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
const MAX_ORBS = 48;

/** ナゴリの樹：大きな樹、ひろがる根、灯りの粒 */
export class NagoriScene extends Scene {
  private L: TreeLayout = treeLayout(1, 1);
  private blobs: Blob[] = [];
  private sprites: HTMLCanvasElement[] = [];
  private roots: Root[] = [];
  private pulses: Pulse[] = [];
  private motes: Particle[] = [];
  private leaves: Particle[] = [];
  private sparks: Particle[] = [];
  private spirits: Spirit[] = [];
  private risers: Riser[] = [];
  private orbs: { x: number; y: number; hue: number; phase: number }[] = [];
  private lit = 0;
  private target = 3;
  private glow = 0;
  private wind = 0;
  private px = -1;
  private py = -1;

  protected layout() {
    const L = (this.L = treeLayout(this.w, this.h));
    const r = seeded(8);
    this.blobs = [];
    const n = Math.round(120 * Math.min(1.2, Math.max(0.7, L.rx / 380)));
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r());
      const x = L.cx + Math.cos(a) * L.rx * d * 0.92;
      const y = L.cy + Math.sin(a) * L.ry * d * 0.95;
      // 上と手前（下）ほど明るい
      const light = clamp(0.5 - (y - L.cy) / (L.ry * 2) + r() * 0.5, 0, 0.999);
      this.blobs.push({ x, y, r: L.rx * (0.13 + r() * 0.11), tone: Math.floor(light * TONES.length) * 2 + (r() > 0.5 ? 1 : 0), phase: r() * 6 });
    }
    this.blobs.sort((a, b) => a.tone - b.tone);
    this.sprites = TONES.flatMap((c, i) => [this.sprite(c, i * 10 + 1), this.sprite(c, i * 10 + 2)]);

    const rr = seeded(15);
    this.roots = [];
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      const spread = (0.15 + rr() * 0.85) * side;
      const len = L.rx * (0.6 + rr() * 0.9);
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const q = k / 16;
        pts.push({
          x: L.baseX + spread * len * q + Math.sin(q * 6 + i) * 10 * q,
          y: L.baseY - 4 + q * (this.h - L.baseY) * (0.35 + rr() * 0.12) * (0.5 + Math.abs(spread)),
        });
      }
      this.roots.push({ pts });
    }

    const os = seeded(31);
    this.orbs = Array.from({ length: MAX_ORBS }, () => {
      const p = canopyPoint(L, os(), os());
      return { ...p, hue: 40 + os() * 30, phase: os() * 6 };
    });

    const unit = Math.max(0.7, Math.min(1.2, L.rx / 420));
    this.spirits = [
      { x: L.baseX - L.rx * 0.55, y: L.baseY + 16 * unit, size: 15 * unit, hop: 0, vy: 0, blink: 2, look: 0 },
      { x: L.baseX + L.rx * 0.42, y: L.baseY + 28 * unit, size: 12 * unit, hop: 0, vy: 0, blink: 4, look: 0 },
      { x: L.baseX + L.rx * 0.78, y: L.baseY + 8 * unit, size: 10 * unit, hop: 0, vy: 0, blink: 6, look: 0 },
    ];
    if (this.motes.length === 0) {
      for (let i = 0; i < 40 * this.density; i++) this.motes.push(this.mote(rand(0, this.h)));
    }
  }

  get layoutInfo() {
    return this.L;
  }

  /** 葉のかたまり。小さな円を重ねて、ふちが揺らぐ形にする */
  private sprite(color: string, seed: number) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const r = seeded(seed);
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 34;
      const x = 64 + Math.cos(a) * d;
      const y = 64 + Math.sin(a) * d * 0.85;
      const rad = 12 + r() * 16;
      const grad = g.createRadialGradient(x - rad * 0.3, y - rad * 0.35, 1, x, y, rad);
      grad.addColorStop(0, shade(color, 1.25));
      grad.addColorStop(0.65, color);
      grad.addColorStop(1, shade(color, 0.7));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
    // 葉先の点描
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2;
      const d = 30 + r() * 26;
      g.fillStyle = shade(color, 0.8 + r() * 0.6);
      g.beginPath();
      g.ellipse(64 + Math.cos(a) * d, 64 + Math.sin(a) * d * 0.85, 3 + r() * 3, 1.6 + r() * 1.5, a, 0, Math.PI * 2);
      g.fill();
    }
    return c;
  }

  private mote(y = this.h + 10): Particle {
    const max = rand(8, 16);
    return { x: rand(0, this.w), y, vx: 0, vy: -rand(8, 22), life: max, max, size: rand(1, 2.6), hue: rand(45, 140), seed: Math.random() * 10 };
  }

  setLightLevel(n: number) {
    this.target = clamp(n, 0, MAX_ORBS);
    while (this.lit + this.risers.length < this.target) {
      const orb = this.orbs[this.lit + this.risers.length];
      this.risers.push({ x: this.L.baseX + rand(-12, 12), y: this.L.baseY, tx: orb.x, ty: orb.y, k: 0, hue: orb.hue });
    }
  }

  /** 初回表示時など、演出なしで灯りをそろえる */
  setLightImmediate(n: number) {
    this.lit = this.target = clamp(n, 0, MAX_ORBS);
    this.risers = [];
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    const L = this.L;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#071419');
    sky.addColorStop(0.4, '#0e2a2c');
    sky.addColorStop(0.7, '#1c3b33');
    sky.addColorStop(1, '#091510');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    drawStars(ctx, w, h, Math.round(120 * Math.min(1.4, (w * h) / 1e6)), 19, 0.45);

    // 奥の丘
    for (const [base, col, seed] of [
      [0.7, '#123128', 2],
      [0.76, '#0c241d', 5],
    ] as const) {
      const r = seeded(seed);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * base);
      for (let x = 0; x <= w + 40; x += 40) ctx.lineTo(x, h * base - Math.sin(x * 0.004 + seed) * h * 0.04 - r() * 6);
      ctx.lineTo(w, h);
      ctx.fill();
    }
    // 霧
    const mist = ctx.createLinearGradient(0, h * 0.6, 0, h * 0.85);
    mist.addColorStop(0, 'rgba(150,210,190,0)');
    mist.addColorStop(0.6, 'rgba(150,210,190,0.08)');
    mist.addColorStop(1, 'rgba(150,210,190,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, h * 0.6, w, h * 0.25);

    // 地面
    ctx.fillStyle = '#07120d';
    ctx.beginPath();
    ctx.ellipse(L.baseX, h * 1.05, w * 0.9, h - L.baseY + h * 0.05, 0, Math.PI, 0);
    ctx.fill();

    // 根
    ctx.lineCap = 'round';
    for (const root of this.roots) {
      ctx.strokeStyle = '#1a120d';
      for (let k = 1; k < root.pts.length; k++) {
        ctx.lineWidth = (1 - k / root.pts.length) * L.rx * 0.07 + 1;
        ctx.beginPath();
        ctx.moveTo(root.pts[k - 1].x, root.pts[k - 1].y);
        ctx.lineTo(root.pts[k].x, root.pts[k].y);
        ctx.stroke();
      }
    }

    // 幹と枝
    const tw = L.rx * 0.2;
    const trunk = ctx.createLinearGradient(L.baseX - tw, 0, L.baseX + tw, 0);
    trunk.addColorStop(0, '#120c09');
    trunk.addColorStop(0.45, '#33241a');
    trunk.addColorStop(1, '#0e0907');
    ctx.fillStyle = trunk;
    ctx.beginPath();
    ctx.moveTo(L.baseX - tw * 1.6, L.baseY + 6);
    ctx.bezierCurveTo(L.baseX - tw * 0.6, L.baseY - 20, L.baseX - tw * 0.8, L.trunkTop + 40, L.baseX - tw * 0.45, L.trunkTop);
    ctx.lineTo(L.baseX + tw * 0.45, L.trunkTop);
    ctx.bezierCurveTo(L.baseX + tw * 0.75, L.trunkTop + 40, L.baseX + tw * 0.5, L.baseY - 20, L.baseX + tw * 1.7, L.baseY + 6);
    ctx.fill();
    ctx.strokeStyle = '#2a1d14';
    const br = seeded(44);
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1;
      const sy = L.trunkTop + 10 + br() * 40;
      const ex = L.baseX + side * L.rx * (0.35 + br() * 0.5);
      const ey = L.cy + (br() - 0.6) * L.ry * 0.8;
      ctx.lineWidth = tw * (0.25 + br() * 0.2);
      ctx.beginPath();
      ctx.moveTo(L.baseX + side * tw * 0.2, sy);
      ctx.quadraticCurveTo(L.baseX + side * L.rx * 0.2, sy - 20, ex, ey);
      ctx.stroke();
    }
    // 樹皮の筋
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(L.baseX + i * tw * 0.25, L.baseY - 10);
      ctx.quadraticCurveTo(L.baseX + i * tw * 0.35, (L.baseY + L.trunkTop) / 2, L.baseX + i * tw * 0.15, L.trunkTop + 10);
      ctx.stroke();
    }
  }

  protected frame(dt: number) {
    const { ctx, t, L } = this;
    this.glow = Math.max(0, this.glow - dt * 0.5);
    this.wind = Math.max(0, this.wind - dt * 0.4);

    // 根を流れる光
    if (Math.random() < dt * (1.2 + this.glow * 8)) {
      this.pulses.push({ root: Math.floor(Math.random() * this.roots.length), p: 1, speed: rand(0.25, 0.45), hue: rand(120, 170) });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pu = this.pulses[i];
      pu.p -= pu.speed * dt;
      if (pu.p <= 0) {
        this.pulses.splice(i, 1);
        continue;
      }
      const pts = this.roots[pu.root].pts;
      const f = pu.p * (pts.length - 1);
      const a = pts[Math.floor(f)];
      const b = pts[Math.min(pts.length - 1, Math.ceil(f))];
      const x = a.x + (b.x - a.x) * (f % 1);
      const y = a.y + (b.y - a.y) * (f % 1);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 18);
      g.addColorStop(0, `hsla(${pu.hue},90%,75%,0.8)`);
      g.addColorStop(1, `hsla(${pu.hue},90%,60%,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - 18, y - 18, 36, 36);
    }

    // 樹の内側のあかり
    const inner = ctx.createRadialGradient(L.cx, L.cy, 10, L.cx, L.cy, L.rx * 1.1);
    const level = 0.08 + (this.lit / MAX_ORBS) * 0.22 + this.glow * 0.2;
    inner.addColorStop(0, `rgba(190,255,200,${level})`);
    inner.addColorStop(1, 'rgba(190,255,200,0)');
    ctx.fillStyle = inner;
    ctx.fillRect(L.cx - L.rx * 1.2, L.cy - L.rx * 1.2, L.rx * 2.4, L.rx * 2.4);
    ctx.globalCompositeOperation = 'source-over';

    // 樹冠（上ほど大きく揺れる）
    const amp = 4 + this.wind * 14;
    for (const b of this.blobs) {
      const k = clamp(1 - (b.y - (L.cy - L.ry)) / (L.ry * 2), 0, 1);
      const sway = Math.sin(t * 0.9 + b.phase + b.x * 0.004) * amp * (0.3 + k);
      const r = b.r * (1 + Math.sin(t * 0.6 + b.phase) * 0.03);
      ctx.drawImage(this.sprites[b.tone], b.x + sway - r, b.y - r + Math.cos(t * 0.7 + b.phase) * 1.5, r * 2, r * 2);
    }

    // 灯り
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.lit; i++) {
      const o = this.orbs[i];
      const sway = Math.sin(t * 0.9 + o.x * 0.004) * amp * 0.6;
      const a = 0.65 + Math.sin(t * 2 + o.phase) * 0.25;
      const g = ctx.createRadialGradient(o.x + sway, o.y, 0, o.x + sway, o.y, 16);
      g.addColorStop(0, `hsla(${o.hue},100%,80%,${a})`);
      g.addColorStop(0.3, `hsla(${o.hue},100%,65%,${a * 0.4})`);
      g.addColorStop(1, `hsla(${o.hue},100%,60%,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(o.x + sway - 16, o.y - 16, 32, 32);
    }
    // 根から昇る光
    for (let i = this.risers.length - 1; i >= 0; i--) {
      const r = this.risers[i];
      r.k += dt * 0.7;
      const e = r.k < 1 ? 1 - Math.pow(1 - r.k, 3) : 1;
      const midX = L.baseX;
      const midY = L.trunkTop;
      // 幹を昇ってから枝先へ
      const x = e < 0.5 ? r.x + (midX - r.x) * (e * 2) : midX + (r.tx - midX) * ((e - 0.5) * 2);
      const y = e < 0.5 ? r.y + (midY - r.y) * (e * 2) : midY + (r.ty - midY) * ((e - 0.5) * 2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
      g.addColorStop(0, `hsla(${r.hue},100%,85%,0.95)`);
      g.addColorStop(1, `hsla(${r.hue},100%,60%,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - 22, y - 22, 44, 44);
      if (r.k >= 1) {
        this.risers.splice(i, 1);
        this.lit = Math.min(MAX_ORBS, this.lit + 1);
        this.sparkle(r.tx, r.ty, r.hue, 10);
      }
    }

    // 漂う光の粒
    for (const m of this.motes) {
      m.x += Math.sin(t * 0.5 + m.seed) * 10 * dt;
      m.y += m.vy * dt;
      if (this.px >= 0) {
        const dx = this.px - m.x;
        const dy = this.py - m.y;
        const d = Math.hypot(dx, dy);
        if (d < 140 && d > 1) {
          m.x += (dx / d) * 16 * dt;
          m.y += (dy / d) * 16 * dt;
        }
      }
      const a = Math.min(1, m.life / 2, (m.max - m.life) / 2) * 0.8;
      ctx.fillStyle = `hsla(${m.hue},80%,70%,${a * 0.25})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${m.hue},90%,85%,${a})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const m of this.motes) m.life -= dt;
    for (let i = 0; i < this.motes.length; i++) {
      if (this.motes[i].life <= 0) this.motes[i] = this.mote();
    }
    this.drawSparks(dt);
    ctx.globalCompositeOperation = 'source-over';

    // 舞い落ちる葉
    if (Math.random() < dt * (0.8 + this.wind * 4) * this.density) this.dropLeaf();
    this.drawLeaves(dt);
    this.drawSpirits(dt);
  }

  private dropLeaf(hue = rand(95, 140), light = rand(35, 55)) {
    const p = canopyPoint(this.L, Math.random(), Math.random());
    const max = rand(6, 10);
    this.leaves.push({ x: p.x, y: p.y, vx: rand(-10, 10), vy: rand(20, 40), life: max, max, size: rand(5, 8), hue, light, seed: Math.random() * 10 });
  }

  private drawLeaves(dt: number) {
    const { ctx, t } = this;
    for (const p of this.leaves) {
      p.x += (p.vx + Math.sin(t * 1.5 + p.seed) * 26 + this.wind * 40) * dt;
      p.y += p.vy * dt;
      if (p.y > this.h * 0.95) p.life = Math.min(p.life, 0.5);
      const a = Math.min(1, p.life * 2);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(t * 2 + p.seed) * 1.2);
      ctx.fillStyle = `hsla(${p.hue},60%,${p.light ?? 45}%,${a})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    stepParticles(this.leaves, dt);
  }

  private sparkle(x: number, y: number, hue: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(20, 80);
      const max = rand(0.6, 1.3);
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max, size: rand(1, 2), hue, seed: 0 });
    }
  }

  private drawSparks(dt: number) {
    const { ctx } = this;
    for (const p of this.sparks) {
      const k = p.life / p.max;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2;
      p.vy *= 1 - dt * 2;
      ctx.fillStyle = `hsla(${p.hue},100%,80%,${k})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    stepParticles(this.sparks, dt);
  }

  private drawSpirits(dt: number) {
    const { ctx, t } = this;
    for (const s of this.spirits) {
      s.vy += 900 * dt;
      s.hop = Math.min(0, s.hop + s.vy * dt);
      if (s.hop === 0) s.vy = 0;
      s.blink -= dt;
      if (s.blink < -0.12) s.blink = rand(2, 5);
      const target = this.px >= 0 ? clamp((this.px - s.x) / 300, -1, 1) : Math.sin(t * 0.4 + s.x) * 0.5;
      s.look += (target - s.look) * dt * 4;
      const y = s.y + s.hop + Math.sin(t * 2 + s.x) * 1.2;
      const r = s.size;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(s.x, y, 0, s.x, y, r * 3);
      g.addColorStop(0, 'rgba(200,255,220,0.25)');
      g.addColorStop(1, 'rgba(200,255,220,0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x - r * 3, y - r * 3, r * 6, r * 6);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#e9f6ec';
      ctx.beginPath();
      ctx.ellipse(s.x, y, r, r * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      const eyeH = s.blink < 0 ? 0.6 : r * 0.22;
      ctx.fillStyle = '#1e2b25';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s.x + side * r * 0.35 + s.look * r * 0.2, y - r * 0.1, r * 0.13, eyeH, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,160,170,0.5)';
      ctx.beginPath();
      ctx.arc(s.x + r * 0.55 + s.look * r * 0.1, y + r * 0.25, r * 0.12, 0, Math.PI * 2);
      ctx.arc(s.x - r * 0.55 + s.look * r * 0.1, y + r * 0.25, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private hopAll(power = 1) {
    this.spirits.forEach((s, i) => window.setTimeout(() => (s.vy = -rand(220, 320) * power), i * 120));
  }

  /** 幹に触れたとき */
  touchTrunk() {
    this.glow = 1;
    this.wind = 1;
    for (let i = 0; i < 6; i++) this.pulses.push({ root: i % this.roots.length, p: 1, speed: 0.6, hue: 140 });
    this.sparkle(this.L.baseX, (this.L.baseY + this.L.trunkTop) / 2, 120, 30);
  }

  reaction(id: ReactionId) {
    switch (id) {
      case 'empathy':
        for (let i = 0; i < 12; i++) this.dropLeaf(rand(18, 34), rand(55, 65));
        break;
      case 'more':
        for (let i = 0; i < 6; i++) {
          const p = canopyPoint(this.L, Math.random(), Math.random());
          this.sparkle(p.x, p.y, 52, 8);
        }
        break;
      case 'speak':
        this.glow = 1;
        for (let i = 0; i < this.roots.length; i++) this.pulses.push({ root: i, p: 1, speed: 0.5, hue: 200 });
        this.hopAll(1.2);
        break;
      case 'other':
        this.wind = 0.8;
        for (let i = 0; i < 10; i++) this.dropLeaf(rand(90, 120), rand(55, 68));
        break;
    }
  }

  pointer(x: number, y: number, kind: 'move' | 'down') {
    this.px = x;
    this.py = y;
    if (kind !== 'down') return;
    for (const s of this.spirits) {
      if (Math.hypot(x - s.x, y - (s.y + s.hop)) < s.size * 2) {
        s.vy = -rand(280, 360);
        this.sparkle(s.x, s.y - s.size, 60, 14);
        return 'spirit';
      }
    }
    const L = this.L;
    const tw = L.rx * 0.2;
    if (y > L.trunkTop && y < L.baseY && Math.abs(x - L.baseX) < tw * 0.9) {
      this.touchTrunk();
      return 'trunk';
    }
    const dx = (x - L.cx) / L.rx;
    const dy = (y - L.cy) / L.ry;
    if (dx * dx + dy * dy < 1) {
      this.wind = Math.min(1, this.wind + 0.5);
      this.sparkle(x, y, 90, 8);
      for (let i = 0; i < 3; i++) this.dropLeaf();
      return 'canopy';
    }
  }
}
