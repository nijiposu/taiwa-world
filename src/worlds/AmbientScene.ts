import type { ReactionId } from '../state/types';
import { coverPoint } from '../engine/cover';
import { Scene, rand, stepParticles, type Particle } from '../engine/Scene';

export type AmbientKind = 'sea' | 'bbq' | 'town' | 'fireflies';

const REACTION_HUE: Record<ReactionId, number> = { empathy: 24, more: 50, speak: 200, other: 120 };

/**
 * イラストの上に重ねる、軽い粒子の演出。
 * - sea：立ちのぼる泡、ゆらぐ光の帯、くらげの灯り
 * - bbq：焼き網からの煙と火の粉、ゆれる電飾
 * - town：舞う紙片と光のほこり。「好き」が集まるほど色が戻る
 */
export class AmbientScene extends Scene {
  private bubbles: Particle[] = [];
  private bursts: Particle[] = [];
  private smoke: Particle[] = [];
  private jelly: Particle[] = [];
  private acc = 0;
  /** 絵の中の発生源（焼き網など）。0..1 */
  private source = { u: 0.5, v: 0.6 };

  constructor(
    canvas: HTMLCanvasElement,
    private kind: AmbientKind,
    private aspect: number,
  ) {
    super(canvas);
    this.drawBackdrop = false;
  }

  setSource(u: number, v: number) {
    this.source = { u, v };
  }

  private get src() {
    return coverPoint(this.w, this.h, this.aspect, this.source.u, this.source.v);
  }

  protected layout() {
    if (this.kind === 'sea' && this.jelly.length === 0) {
      for (let i = 0; i < 6; i++) {
        this.jelly.push({ x: rand(0, this.w), y: rand(0, this.h * 0.6), vx: 0, vy: 0, life: 1e9, max: 1e9, size: rand(10, 22), hue: rand(190, 290), seed: rand(0, 10) });
      }
    }
  }

  protected paintBackdrop() {}

  protected frame(dt: number) {
    const { ctx, t, w, h } = this;
    ctx.globalCompositeOperation = 'lighter';

    if (this.kind === 'sea') {
      // 水面から差しこむ光の帯
      for (let i = 0; i < 4; i++) {
        const x = w * (0.2 + i * 0.22) + Math.sin(t * 0.3 + i) * 40;
        const g = ctx.createLinearGradient(x, 0, x + 80, h * 0.8);
        g.addColorStop(0, `rgba(170,220,255,${0.07 + Math.sin(t * 0.5 + i * 2) * 0.03})`);
        g.addColorStop(1, 'rgba(170,220,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 30, 0);
        ctx.lineTo(x + 50, 0);
        ctx.lineTo(x + 220, h * 0.85);
        ctx.lineTo(x + 40, h * 0.85);
        ctx.fill();
      }
      this.acc += dt * 10 * this.density;
      while (this.acc > 1) {
        this.acc -= 1;
        const max = rand(5, 10);
        this.bubbles.push({ x: rand(0, w), y: h + 10, vx: 0, vy: -rand(25, 60), life: max, max, size: rand(1.5, 5), hue: 200, seed: rand(0, 10) });
      }
      for (const b of this.bubbles) {
        b.x += Math.sin(t * 2 + b.seed) * 12 * dt;
        b.y += b.vy * dt;
        ctx.strokeStyle = `rgba(200,235,255,${0.5 * Math.min(1, b.life)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(b.x - b.size * 0.4, b.y - b.size * 0.5, 1.2, 1.2);
      }
      stepParticles(this.bubbles, dt);
      for (const j of this.jelly) {
        j.seed += dt;
        j.y += Math.sin(j.seed * 0.6) * 8 * dt - 4 * dt;
        j.x += Math.cos(j.seed * 0.3) * 6 * dt;
        if (j.y < -40) j.y = this.h * 0.7;
        const pulse = 0.7 + Math.sin(j.seed * 1.8) * 0.3;
        const g = ctx.createRadialGradient(j.x, j.y, 0, j.x, j.y, j.size * 3);
        g.addColorStop(0, `hsla(${j.hue},90%,75%,${0.35 * pulse})`);
        g.addColorStop(1, `hsla(${j.hue},90%,60%,0)`);
        ctx.fillStyle = g;
        ctx.fillRect(j.x - j.size * 3, j.y - j.size * 3, j.size * 6, j.size * 6);
      }
    }

    if (this.kind === 'bbq') {
      const s = this.src;
      this.acc += dt * 14 * this.density;
      while (this.acc > 1) {
        this.acc -= 1;
        const max = rand(1.2, 2.6);
        this.bubbles.push({ x: s.x + rand(-40, 40), y: s.y - 10, vx: rand(-20, 20), vy: -rand(50, 110), life: max, max, size: rand(1, 2.2), hue: rand(20, 45), seed: rand(0, 10) });
        if (Math.random() < 0.35) {
          const sm = rand(3, 5);
          this.smoke.push({ x: s.x + rand(-30, 30), y: s.y - 20, vx: rand(-6, 6), vy: -rand(18, 30), life: sm, max: sm, size: rand(18, 30), hue: 0, seed: rand(0, 10) });
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const p of this.smoke) {
        const k = 1 - p.life / p.max;
        p.x += (p.vx + Math.sin(t + p.seed) * 8) * dt;
        p.y += p.vy * dt;
        ctx.fillStyle = `rgba(220,210,230,${0.09 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + k * 1.5), 0, Math.PI * 2);
        ctx.fill();
      }
      stepParticles(this.smoke, dt);
      ctx.globalCompositeOperation = 'lighter';
      this.drawSparks(this.bubbles, dt, -10);
    }

    if (this.kind === 'town') {
      this.acc += dt * 3 * this.density;
      while (this.acc > 1) {
        this.acc -= 1;
        const max = rand(8, 14);
        this.smoke.push({ x: rand(-40, w), y: rand(-20, h * 0.4), vx: rand(15, 35), vy: rand(8, 20), life: max, max, size: rand(5, 9), hue: rand(30, 50), seed: rand(0, 10) });
        this.bubbles.push({ x: rand(0, w), y: h + 5, vx: 0, vy: -rand(10, 25), life: max, max, size: rand(0.8, 1.8), hue: rand(260, 300), seed: rand(0, 10) });
      }
      ctx.globalCompositeOperation = 'source-over';
      // 舞う紙片（手放された「やりたいこと」のメモ）
      for (const p of this.smoke) {
        p.x += (p.vx + Math.sin(t + p.seed) * 10) * dt;
        p.y += (p.vy + Math.cos(t * 1.3 + p.seed) * 10) * dt;
        const a = Math.min(1, p.life / 2, (p.max - p.life) / 1.5) * 0.75;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.sin(t * 1.5 + p.seed) * 1.2);
        ctx.fillStyle = `rgba(245,232,205,${a})`;
        ctx.fillRect(-p.size, -p.size * 0.7, p.size * 2, p.size * 1.4);
        ctx.fillStyle = `rgba(120,100,140,${a * 0.6})`;
        ctx.fillRect(-p.size * 0.7, -p.size * 0.3, p.size * 1.4, 0.8);
        ctx.fillRect(-p.size * 0.7, p.size * 0.1, p.size, 0.8);
        ctx.restore();
      }
      stepParticles(this.smoke, dt);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.bubbles) {
        p.x += Math.sin(t * 0.7 + p.seed) * 10 * dt;
        p.y += p.vy * dt;
        const a = Math.min(1, p.life / 2) * 0.8;
        ctx.fillStyle = `hsla(${p.hue},80%,80%,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      stepParticles(this.bubbles, dt);
    }

    if (this.kind === 'fireflies') {
      if (this.jelly.length === 0) {
        for (let i = 0; i < 40; i++) this.jelly.push({ x: rand(0, w), y: rand(h * 0.2, h), vx: 0, vy: 0, life: 1e9, max: 1e9, size: rand(1.2, 2.4), hue: rand(45, 80), seed: rand(0, 100) });
      }
      for (const f of this.jelly) {
        f.seed += dt;
        f.x += Math.cos(f.seed * 0.37) * 14 * dt;
        f.y += Math.sin(f.seed * 0.51) * 9 * dt;
        const a = Math.max(0, Math.sin(f.seed * 1.7)) ** 2 * 0.9 + 0.05;
        ctx.fillStyle = `hsla(${f.hue},90%,65%,${a * 0.22})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${f.hue},100%,85%,${a})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this.drawSparks(this.bursts, dt, 40);
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawSparks(list: Particle[], dt: number, gravity: number) {
    const { ctx, t } = this;
    for (const p of list) {
      const k = 1 - p.life / p.max;
      p.vx *= 1 - dt * 1.2;
      p.vy = p.vy * (1 - dt * 1.2) + gravity * dt;
      p.x += (p.vx + Math.sin(t * 3 + p.seed) * 8) * dt;
      p.y += p.vy * dt;
      const a = (1 - k) * (0.7 + 0.3 * Math.sin(t * 18 + p.seed * 5));
      ctx.fillStyle = `hsla(${p.hue},100%,65%,${a * 0.3})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${p.hue},100%,82%,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    stepParticles(list, dt);
  }

  /** 絵の中の位置(0..1)から、光の粒をはじけさせる */
  burst(u: number, v: number, hue: number, count = 40, speed = 1) {
    const p = coverPoint(this.w, this.h, this.aspect, u, v);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 200) * speed;
      const max = rand(1, 2.2);
      this.bursts.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: max, max, size: rand(1.2, 2.6), hue: hue + rand(-15, 15), seed: rand(0, 10) });
    }
  }

  reaction(id: ReactionId) {
    const hue = REACTION_HUE[id];
    if (this.kind === 'sea') {
      for (let i = 0; i < (id === 'speak' ? 50 : 25); i++) {
        const max = rand(3, 6);
        this.bubbles.push({ x: rand(this.w * 0.2, this.w * 0.8), y: this.h + rand(0, 40), vx: 0, vy: -rand(80, 160), life: max, max, size: rand(3, 9), hue: 200, seed: rand(0, 10) });
      }
      this.burst(rand(0.3, 0.7), rand(0.25, 0.5), hue, id === 'speak' ? 70 : 35);
    } else if (this.kind === 'bbq') {
      this.burst(this.source.u, this.source.v - 0.04, hue, id === 'speak' ? 80 : 40, 1.3);
    } else {
      this.burst(rand(0.25, 0.75), rand(0.3, 0.6), hue, id === 'speak' ? 70 : 36);
    }
  }
}
