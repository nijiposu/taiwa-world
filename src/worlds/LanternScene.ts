import type { Keepsake, ReactionId } from '../state/types';
import {
  Scene,
  drawStars,
  drawTwinkles,
  makeTwinkles,
  rand,
  seeded,
  stepParticles,
  type Particle,
  type Twinkle,
} from '../engine/Scene';

interface Rocket {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  hue: number;
  size: number;
  trail: { x: number; y: number }[];
}

interface FloatingLantern {
  id: string;
  x: number;
  lane: number;
  speed: number;
  phase: number;
  hue: number;
  text: string;
  born: number;
}

const PALETTE = [8, 22, 38, 48, 330, 280, 195];

/** 灯籠祭：流れる灯籠、ひらく花火、ゆれる提灯 */
export class LanternScene extends Scene {
  private rockets: Rocket[] = [];
  private sparks: Particle[] = [];
  private glints: Particle[] = [];
  private lanterns: FloatingLantern[] = [];
  private known = new Set<string>();
  private twinkles: Twinkle[] = [];
  private nextAuto = 2.5;
  private waterY = 0;
  private flash = 0;

  protected layout() {
    this.waterY = this.h * 0.66;
    this.twinkles = makeTwinkles(this.w, this.h, Math.round(60 * this.density), 5, 0.5);
    if (this.lanterns.length === 0) {
      for (let i = 0; i < 9; i++) this.addLantern(rand(-0.05, 1.05), '', true);
    }
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    const wy = this.waterY;
    const sky = ctx.createLinearGradient(0, 0, 0, wy);
    sky.addColorStop(0, '#05051a');
    sky.addColorStop(0.55, '#16123d');
    sky.addColorStop(0.85, '#3b1f4f');
    sky.addColorStop(1, '#6a3150');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, wy);
    drawStars(ctx, w, h, Math.round(200 * Math.min(1.4, (w * h) / 1e6)), 9, 0.5);

    // 遠くの山
    const r = seeded(4);
    ctx.fillStyle = '#1d1435';
    ctx.beginPath();
    ctx.moveTo(0, wy);
    for (let x = 0; x <= w; x += w / 12) ctx.lineTo(x, wy - h * (0.08 + r() * 0.1));
    ctx.lineTo(w, wy);
    ctx.fill();

    // 町並み（屋根と窓あかり）
    const town = seeded(12);
    let x = -10;
    while (x < w) {
      const bw = 40 + town() * 70;
      const bh = h * (0.04 + town() * 0.06);
      const top = wy - bh;
      ctx.fillStyle = '#120c24';
      ctx.fillRect(x, top, bw, bh);
      // 瓦屋根
      ctx.beginPath();
      ctx.moveTo(x - 8, top + 2);
      ctx.quadraticCurveTo(x + bw / 2, top - bh * 0.55, x + bw + 8, top + 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        if (town() > 0.55) {
          ctx.fillStyle = `rgba(255,${170 + town() * 50},90,${0.5 + town() * 0.4})`;
          ctx.fillRect(x + 6 + i * (bw / 3.2), top + bh * 0.35, 6, 8);
        }
      }
      x += bw + town() * 14;
    }

    // 水面
    const water = ctx.createLinearGradient(0, wy, 0, h);
    water.addColorStop(0, '#2a1838');
    water.addColorStop(0.25, '#120d26');
    water.addColorStop(1, '#05040f');
    ctx.fillStyle = water;
    ctx.fillRect(0, wy, w, h - wy);
    // 町あかりの映り込み
    ctx.globalCompositeOperation = 'lighter';
    const ref = seeded(12);
    for (let i = 0; i < 40; i++) {
      const rx = ref() * w;
      const ry = wy + ref() * h * 0.08;
      ctx.fillStyle = `rgba(255,170,90,${0.05 + ref() * 0.08})`;
      ctx.fillRect(rx, ry, 18 + ref() * 30, 1.5);
    }
    ctx.globalCompositeOperation = 'source-over';
    // 岸
    ctx.fillStyle = '#07050d';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.93);
    ctx.quadraticCurveTo(w * 0.3, h * 0.9, w * 0.55, h * 0.95);
    ctx.quadraticCurveTo(w * 0.8, h * 0.99, w, h * 0.94);
    ctx.lineTo(w, h);
    ctx.fill();
  }

  /** 状態にある灯籠（みんなが流したもの）を川に浮かべる */
  syncLanterns(list: Keepsake[]) {
    for (const k of list) {
      if (this.known.has(k.id)) continue;
      this.known.add(k.id);
      const fresh = Date.now() - k.at < 4000;
      this.addLantern(fresh ? rand(0.3, 0.42) : rand(0, 1), k.text, !fresh, k.id);
    }
  }

  private addLantern(x: number, text: string, settled: boolean, id = Math.random().toString(36)) {
    this.lanterns.push({
      id,
      x,
      lane: rand(0.08, 0.8),
      speed: rand(0.006, 0.013),
      phase: rand(0, Math.PI * 2),
      hue: rand(22, 40),
      text,
      born: settled ? -10 : this.t,
    });
    if (this.lanterns.length > 26) {
      const idx = this.lanterns.findIndex((l) => !l.text);
      this.lanterns.splice(idx >= 0 ? idx : 0, 1);
    }
  }

  launch(x = rand(this.w * 0.15, this.w * 0.85), targetY = rand(this.h * 0.12, this.h * 0.38), hue?: number, size = 1) {
    this.rockets.push({
      x,
      y: this.waterY,
      vy: -rand(520, 640),
      targetY,
      hue: hue ?? PALETTE[Math.floor(Math.random() * PALETTE.length)],
      size,
      trail: [],
    });
  }

  private explode(r: Rocket) {
    const n = Math.round((70 + Math.random() * 50) * this.density * r.size + 20);
    const ring = Math.random() > 0.6;
    const speed = rand(140, 220) * r.size * Math.max(0.7, Math.min(1.2, this.h / 800));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05);
      const v = ring ? speed : speed * Math.sqrt(Math.random());
      const max = rand(1.4, 2.4);
      this.sparks.push({
        x: r.x,
        y: r.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: max,
        max,
        size: rand(1.2, 2.2),
        hue: r.hue + rand(-12, 12),
        seed: Math.random() * 10,
      });
    }
    this.flash = Math.min(1, this.flash + 0.35 * r.size);
  }

  protected frame(dt: number) {
    const { ctx, t, w, h } = this;
    const wy = this.waterY;

    drawTwinkles(ctx, this.twinkles, t);

    // 花火の光で空がほのかに明るくなる
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,190,160,${this.flash * 0.08})`;
      ctx.fillRect(0, 0, w, wy);
      this.flash = Math.max(0, this.flash - dt * 1.2);
    }

    this.nextAuto -= dt;
    if (this.nextAuto <= 0) {
      this.launch();
      if (Math.random() > 0.7) this.launch();
      this.nextAuto = rand(3.5, 7.5);
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.trail.push({ x: r.x, y: r.y });
      if (r.trail.length > 10) r.trail.shift();
      r.y += r.vy * dt;
      r.x += Math.sin(t * 12 + i) * 0.4;
      r.vy *= 1 - dt * 0.5;
      ctx.strokeStyle = `hsla(${r.hue},90%,75%,0.6)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      r.trail.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      if (r.y <= r.targetY || r.vy > -60) {
        this.explode(r);
        this.rockets.splice(i, 1);
      }
    }
    for (const p of this.sparks) {
      const k = 1 - p.life / p.max;
      p.vx *= 1 - dt * 1.6;
      p.vy = p.vy * (1 - dt * 1.6) + 70 * dt;
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
      // 水面への映り込み
      if (p.y < wy) {
        const ry = wy + (wy - p.y) * 0.35;
        if (ry < h) {
          ctx.fillStyle = `hsla(${p.hue},90%,65%,${a * 0.12})`;
          ctx.fillRect(p.x - 3, ry, 6, 1.4);
        }
      }
    }
    stepParticles(this.sparks, dt);
    ctx.globalCompositeOperation = 'source-over';

    // 水面のさざなみ
    ctx.strokeStyle = 'rgba(180,160,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const y = wy + 6 + i * ((h - wy) / 14);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) {
        const yy = y + Math.sin(x * 0.02 + t * 1.2 + i) * 2;
        x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }

    // 灯籠（奥のものから描く）
    const sorted = [...this.lanterns].sort((a, b) => a.lane - b.lane);
    for (const l of sorted) {
      l.x += l.speed * dt;
      if (l.x > 1.08) {
        if (l.text) {
          // 言葉の灯籠は流れきったらそっと消える
          this.lanterns.splice(this.lanterns.indexOf(l), 1);
          continue;
        }
        l.x = -0.06;
      }
      this.drawLantern(l);
    }

    // 川面のきらめき
    if (Math.random() < dt * 8 * this.density) {
      const max = rand(0.6, 1.4);
      this.glints.push({ x: rand(0, w), y: rand(wy + 4, h * 0.95), vx: 0, vy: 0, life: max, max, size: rand(6, 16), hue: 40, seed: 0 });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const g of this.glints) {
      const k = g.life / g.max;
      ctx.fillStyle = `hsla(${g.hue},90%,75%,${Math.sin(k * Math.PI) * 0.35})`;
      ctx.fillRect(g.x - g.size / 2, g.y, g.size, 1.2);
      g.y -= (g.vy || 0) * dt;
    }
    stepParticles(this.glints, dt);
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawLantern(l: FloatingLantern) {
    const { ctx, t, w, h } = this;
    const wy = this.waterY;
    const depth = 0.45 + l.lane * 0.75;
    const x = l.x * w;
    const y = wy + 10 + l.lane * (h * 0.93 - wy - 30) + Math.sin(t * 1.4 + l.phase) * 2.5;
    const s = depth * Math.max(0.75, Math.min(1.3, w / 1100));
    const bw = 20 * s;
    const bh = 22 * s;
    const glow = 0.85 + Math.sin(t * 3 + l.phase) * 0.1;
    const fade = Math.min(1, (t - l.born) / 1.5);

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - bh / 2, 1, x, y - bh / 2, 60 * s);
    g.addColorStop(0, `hsla(${l.hue},100%,65%,${0.35 * glow})`);
    g.addColorStop(1, `hsla(${l.hue},100%,50%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - 60 * s, y - bh / 2 - 60 * s, 120 * s, 120 * s);
    // 映り込み
    const rg = ctx.createLinearGradient(0, y, 0, y + 50 * s);
    rg.addColorStop(0, `hsla(${l.hue},100%,60%,${0.35 * glow})`);
    rg.addColorStop(1, `hsla(${l.hue},100%,60%,0)`);
    ctx.fillStyle = rg;
    for (let i = 0; i < 6; i++) {
      const ww = bw * (1 - i * 0.12) + Math.sin(t * 4 + i + l.phase) * 2;
      ctx.fillRect(x - ww / 2, y + 2 + i * 7 * s, ww, 2.2 * s);
    }
    ctx.globalCompositeOperation = 'source-over';
    // 台
    ctx.fillStyle = '#2b1712';
    ctx.fillRect(x - bw * 0.65, y - 3 * s, bw * 1.3, 4 * s);
    // 和紙
    const paper = ctx.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
    paper.addColorStop(0, `hsl(${l.hue},90%,${55 * glow}%)`);
    paper.addColorStop(0.5, `hsl(${l.hue + 10},100%,${78 * glow}%)`);
    paper.addColorStop(1, `hsl(${l.hue},90%,${55 * glow}%)`);
    ctx.fillStyle = paper;
    ctx.fillRect(x - bw / 2, y - 3 * s - bh, bw, bh);
    ctx.strokeStyle = 'rgba(60,25,15,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - bw / 2, y - 3 * s - bh, bw, bh);
    ctx.beginPath();
    ctx.moveTo(x, y - 3 * s - bh);
    ctx.lineTo(x, y - 3 * s);
    ctx.stroke();
    // 屋根
    ctx.fillStyle = '#2b1712';
    ctx.beginPath();
    ctx.moveTo(x - bw * 0.7, y - 3 * s - bh);
    ctx.lineTo(x, y - 3 * s - bh - 6 * s);
    ctx.lineTo(x + bw * 0.7, y - 3 * s - bh);
    ctx.fill();
    // 託された一言
    if (l.text) {
      const age = t - l.born;
      const a = age < 0 ? 0.55 : Math.max(0.55, 1 - age / 8);
      ctx.font = `${Math.round(12 + 3 * depth)}px "Zen Old Mincho", serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,236,205,${a})`;
      ctx.shadowColor = 'rgba(255,150,80,0.9)';
      ctx.shadowBlur = 10;
      ctx.fillText(l.text, x, y - bh - 18 * s - Math.min(20, Math.max(0, age) * 4));
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  reaction(id: ReactionId) {
    switch (id) {
      case 'empathy':
        this.launch(undefined, undefined, 18, 0.8);
        break;
      case 'more':
        for (let i = 0; i < 30; i++) {
          const max = rand(1, 2.2);
          this.glints.push({
            x: rand(0, this.w),
            y: rand(this.waterY, this.h),
            vx: 0,
            vy: rand(20, 50),
            life: max,
            max,
            size: rand(10, 24),
            hue: 48,
            seed: 0,
          });
        }
        this.launch(undefined, undefined, 48, 0.6);
        break;
      case 'speak':
        this.launch(this.w * 0.5, this.h * 0.2, 200, 1.4);
        break;
      case 'other':
        this.launch(undefined, undefined, 130, 0.9);
        break;
    }
  }

  pointer(x: number, y: number, kind: 'move' | 'down') {
    if (kind === 'down' && y < this.waterY - 20) {
      this.rockets.push({ x, y: this.waterY, vy: -rand(560, 660), targetY: y, hue: PALETTE[Math.floor(Math.random() * PALETTE.length)], size: 1, trail: [] });
    }
  }
}
