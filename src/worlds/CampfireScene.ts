import type { ReactionId } from '../state/types';
import {
  Scene,
  drawShootingStars,
  drawStars,
  drawTwinkles,
  flicker,
  makeTwinkles,
  rand,
  seeded,
  spawnShootingStar,
  stepParticles,
  type Particle,
  type ShootingStar,
  type Twinkle,
} from '../engine/Scene';

/** 焚き火の広場：夜の森、揺れる炎、舞う火の粉 */
export class CampfireScene extends Scene {
  private flames: Particle[] = [];
  private embers: Particle[] = [];
  private sparks: Particle[] = [];
  private fireflies: Particle[] = [];
  private twinkles: Twinkle[] = [];
  private stars: ShootingStar[] = [];
  private fx = 0;
  private fy = 0;
  private scale = 1;
  private boost = 0;
  private flameAcc = 0;
  private emberAcc = 0;

  protected layout() {
    this.fx = this.w * 0.5;
    this.fy = this.h * 0.7;
    this.scale = Math.max(0.6, Math.min(1.25, Math.min(this.w / 1100, this.h / 760)));
    this.twinkles = makeTwinkles(this.w, this.h, Math.round(70 * this.density), 11, 0.45);
    if (this.fireflies.length === 0) {
      for (let i = 0; i < 14; i++) this.fireflies.push(this.firefly());
    }
  }

  get firePoint() {
    return { x: this.fx, y: this.fy };
  }

  private firefly(): Particle {
    return {
      x: rand(0, this.w),
      y: rand(this.h * 0.45, this.h * 0.85),
      vx: 0,
      vy: 0,
      life: 1e9,
      max: 1e9,
      size: rand(1.2, 2.2),
      hue: rand(60, 95),
      seed: Math.random() * 100,
    };
  }

  protected paintBackdrop(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#070a17');
    sky.addColorStop(0.45, '#0f1530');
    sky.addColorStop(0.62, '#1a1a2c');
    sky.addColorStop(1, '#0b0806');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    drawStars(ctx, w, h, Math.round(260 * Math.min(1.4, (w * h) / 1e6)), 3, 0.55);

    // 月
    const mx = w * 0.82;
    const my = h * 0.16;
    const mr = Math.max(18, Math.min(w, h) * 0.04);
    const halo = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 6);
    halo.addColorStop(0, 'rgba(220,226,255,0.25)');
    halo.addColorStop(1, 'rgba(220,226,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    // 三日月（欠けた部分は透明にくり抜く）
    const moon = document.createElement('canvas');
    moon.width = moon.height = Math.ceil(mr * 2 + 4);
    const m = moon.getContext('2d');
    if (m) {
      const c = mr + 2;
      m.fillStyle = '#f2efe2';
      m.beginPath();
      m.arc(c, c, mr, 0, Math.PI * 2);
      m.fill();
      m.globalCompositeOperation = 'destination-out';
      m.beginPath();
      m.arc(c + mr * 0.45, c - mr * 0.2, mr * 0.92, 0, Math.PI * 2);
      m.fill();
      ctx.drawImage(moon, mx - c, my - c);
    }

    // 背後にそびえるナゴリの樹（集合場所は樹のふもと）
    this.bigTree(ctx);

    // 森（奥から手前へ三層）
    const layers = [
      { base: 0.6, height: 0.2, color: '#141a30', count: 34, seed: 21 },
      { base: 0.64, height: 0.27, color: '#0d1122', count: 26, seed: 37 },
      { base: 0.7, height: 0.36, color: '#06070f', count: 16, seed: 53 },
    ];
    for (const layer of layers) {
      const r = seeded(layer.seed);
      ctx.fillStyle = layer.color;
      ctx.fillRect(0, h * layer.base, w, h);
      for (let i = 0; i < layer.count; i++) {
        const x = (i / layer.count) * w + r() * (w / layer.count);
        // 焚き火のまわりは開けておく
        if (Math.abs(x - w * 0.5) < w * 0.18 && layer.base > 0.62) continue;
        const th = h * layer.height * (0.6 + r() * 0.6);
        const tw = th * (0.28 + r() * 0.1);
        this.pine(ctx, x, h * layer.base + 4, tw, th);
      }
      // 霧
      const fog = ctx.createLinearGradient(0, h * (layer.base - 0.08), 0, h * (layer.base + 0.04));
      fog.addColorStop(0, 'rgba(70,80,120,0)');
      fog.addColorStop(1, 'rgba(70,80,120,0.12)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, h * (layer.base - 0.08), w, h * 0.12);
    }

    // 地面
    const ground = ctx.createLinearGradient(0, h * 0.68, 0, h);
    ground.addColorStop(0, '#0d0907');
    ground.addColorStop(1, '#050403');
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 1.02, w * 0.9, h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // 石のかこい
    const s = this.scale;
    const r = seeded(77);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const x = this.fx + Math.cos(a) * 62 * s;
      const y = this.fy + 10 * s + Math.sin(a) * 16 * s;
      if (Math.sin(a) < -0.2) continue;
      ctx.fillStyle = `hsl(25, 10%, ${12 + r() * 8}%)`;
      ctx.beginPath();
      ctx.ellipse(x, y, (12 + r() * 6) * s, (7 + r() * 3) * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 座れる丸太
    this.log(ctx, w * 0.5 - 260 * s, this.fy + 70 * s, 120 * s, -0.12);
    this.log(ctx, w * 0.5 + 260 * s, this.fy + 70 * s, 120 * s, 0.12);
  }

  private bigTree(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    const cx = w * 0.5;
    const base = h * 0.66;
    const R = Math.min(w * 0.42, h * 0.5);
    ctx.fillStyle = '#10162a';
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.16, base);
    ctx.bezierCurveTo(cx - R * 0.08, base - R * 0.3, cx - R * 0.1, base - R * 0.55, cx - R * 0.05, base - R * 0.7);
    ctx.lineTo(cx + R * 0.05, base - R * 0.7);
    ctx.bezierCurveTo(cx + R * 0.1, base - R * 0.55, cx + R * 0.08, base - R * 0.3, cx + R * 0.16, base);
    ctx.fill();
    const r = seeded(91);
    for (let i = 0; i < 60; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r());
      const x = cx + Math.cos(a) * R * 0.95 * d;
      const y = base - R * 0.95 + Math.sin(a) * R * 0.42 * d;
      ctx.beginPath();
      ctx.arc(x, y, R * (0.1 + r() * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    // 枝に灯るあかり
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 0.85;
      const x = cx + Math.cos(a) * R * 0.95 * d;
      const y = base - R * 0.95 + Math.sin(a) * R * 0.42 * d;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, 'rgba(255,236,170,0.9)');
      g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.fillStyle = '#10162a';
    }
  }

  private pine(ctx: CanvasRenderingContext2D, x: number, base: number, tw: number, th: number) {
    ctx.beginPath();
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const top = base - th * (0.35 + (i / tiers) * 0.65);
      const bottom = base - th * ((i / tiers) * 0.6);
      const half = tw * (1 - i / (tiers + 1));
      ctx.moveTo(x, top);
      ctx.lineTo(x + half, bottom);
      ctx.lineTo(x - half, bottom);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillRect(x - tw * 0.06, base - th * 0.08, tw * 0.12, th * 0.1);
  }

  private log(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, rot: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#1b120c';
    ctx.beginPath();
    ctx.roundRect(-len / 2, -11, len, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#2a1c12';
    ctx.beginPath();
    ctx.ellipse(len / 2 - 4, 0, 6, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  protected frame(dt: number) {
    const { ctx, t, fx, fy } = this;
    const s = this.scale;
    this.boost = Math.max(0, this.boost - dt * 0.8);
    const f = flicker(t);
    const intensity = 1 + f * 0.12 + this.boost * 0.5;

    drawTwinkles(ctx, this.twinkles, t);
    drawShootingStars(ctx, this.stars, dt);

    // 地面を照らす光
    ctx.globalCompositeOperation = 'lighter';
    const glowR = (300 + f * 18 + this.boost * 80) * s;
    const glow = ctx.createRadialGradient(fx, fy, 10, fx, fy, glowR * 1.6);
    glow.addColorStop(0, `rgba(255,150,60,${0.32 * intensity})`);
    glow.addColorStop(0.35, `rgba(220,90,30,${0.12 * intensity})`);
    glow.addColorStop(1, 'rgba(120,40,10,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(fx - glowR * 1.6, fy - glowR * 1.6, glowR * 3.2, glowR * 3.2);
    ctx.globalCompositeOperation = 'source-over';

    // 薪
    ctx.save();
    ctx.translate(fx, fy + 8 * s);
    for (const [rot, col] of [
      [0.35, '#3a2416'],
      [-0.35, '#2f1d12'],
      [0.05, '#43291a'],
    ] as const) {
      ctx.save();
      ctx.rotate(rot);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(-50 * s, -7 * s, 100 * s, 14 * s, 7 * s);
      ctx.fill();
      ctx.restore();
    }
    const coal = ctx.createRadialGradient(0, 0, 2, 0, 0, 46 * s);
    coal.addColorStop(0, `rgba(255,140,50,${0.7 + f * 0.2})`);
    coal.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = coal;
    ctx.beginPath();
    ctx.ellipse(0, 0, 46 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 炎
    const rate = (90 + this.boost * 120) * (this.reducedMotion ? 0.5 : 1);
    this.flameAcc += dt * rate;
    while (this.flameAcc > 1) {
      this.flameAcc -= 1;
      const spread = 30 * s * (1 + this.boost * 0.3);
      const max = rand(0.7, 1.25) * (1 + this.boost * 0.4);
      this.flames.push({
        x: fx + rand(-spread, spread) * rand(0.3, 1),
        y: fy + rand(-4, 4) * s,
        vx: rand(-8, 8),
        vy: -rand(70, 120) * s * (1 + this.boost * 0.4),
        life: max,
        max,
        size: rand(16, 28) * s,
        hue: 0,
        seed: Math.random() * 10,
      });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.flames) {
      const k = 1 - p.life / p.max; // 0→1
      p.x += (p.vx + Math.sin(t * 3 + p.seed) * 14 + (fx - p.x) * 1.4) * dt;
      p.y += p.vy * dt;
      const size = p.size * (1 - k * 0.85);
      const hue = 48 - k * 40;
      const light = 72 - k * 30;
      const alpha = (1 - k) * 0.55;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
      g.addColorStop(0, `hsla(${hue},100%,${light}%,${alpha})`);
      g.addColorStop(1, `hsla(${hue - 10},100%,${light - 20}%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    stepParticles(this.flames, dt);

    // 火の粉
    this.emberAcc += dt * (5 + this.boost * 20) * this.density;
    while (this.emberAcc > 1) {
      this.emberAcc -= 1;
      this.spawnEmber(fx + rand(-20, 20) * s, fy - 20 * s, 0);
    }
    this.drawEmbers(this.embers, dt);
    this.drawEmbers(this.sparks, dt);

    // ほたる
    for (const p of this.fireflies) {
      p.seed += dt;
      p.x += Math.cos(p.seed * 0.7) * 18 * dt;
      p.y += Math.sin(p.seed * 1.1) * 10 * dt;
      if (p.x < 0) p.x = this.w;
      if (p.x > this.w) p.x = 0;
      const a = Math.max(0, Math.sin(p.seed * 1.6)) * 0.8;
      ctx.fillStyle = `hsla(${p.hue},90%,70%,${a * 0.25})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${p.hue},100%,85%,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private spawnEmber(x: number, y: number, kind: number, hue = rand(20, 45), speed = 1) {
    const max = rand(1.8, 3.8);
    this.embers.push({
      x,
      y,
      vx: rand(-30, 30) * speed,
      vy: -rand(50, 110) * speed,
      life: max,
      max,
      size: rand(1, 2.4),
      hue,
      seed: Math.random() * 10,
      kind,
    });
  }

  private drawEmbers(list: Particle[], dt: number) {
    const { ctx, t } = this;
    for (const p of list) {
      const k = 1 - p.life / p.max;
      p.vx += Math.sin(t * 2 + p.seed) * 30 * dt;
      p.vy += (p.kind === 2 ? 60 : -6) * dt;
      p.vx *= 1 - dt * 0.6;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = (1 - k) * (0.6 + 0.4 * Math.sin(t * 20 + p.seed * 7));
      const light = p.light ?? 65;
      ctx.fillStyle = `hsla(${p.hue},${p.sat ?? 100}%,${light}%,${a * 0.3})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${p.hue},100%,${light + 15}%,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    stepParticles(list, dt);
  }

  private burst(count: number, hue: () => number, speed = 1, opts: Partial<Particle> = {}) {
    const s = this.scale;
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const v = rand(80, 260) * speed * s;
      const max = rand(1.4, 3);
      this.sparks.push({
        x: this.fx + rand(-14, 14),
        y: this.fy - 26 * s,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: max,
        max,
        size: rand(1.2, 2.8),
        hue: hue(),
        seed: Math.random() * 10,
        kind: 2,
        ...opts,
      });
    }
  }

  /** 焚き火をつつく */
  poke() {
    this.boost = Math.min(1.6, this.boost + 0.9);
    this.burst(Math.round(50 * this.density + 14), () => rand(18, 48));
  }

  reaction(id: ReactionId) {
    switch (id) {
      case 'empathy':
        this.boost = Math.min(1.6, this.boost + 0.5);
        this.burst(40, () => rand(15, 35));
        break;
      case 'more':
        this.burst(36, () => rand(45, 58), 1.2, { light: 75 });
        break;
      case 'speak':
        this.boost = Math.min(1.8, this.boost + 1.2);
        this.burst(60, () => rand(190, 215), 1.4, { light: 72 });
        break;
      case 'other':
        this.burst(40, () => rand(100, 140), 1.1, { light: 62 });
        break;
    }
  }

  pointer(x: number, y: number, kind: 'move' | 'down') {
    if (kind !== 'down') return;
    const d = Math.hypot(x - this.fx, (y - this.fy) * 1.4);
    if (d < 110 * this.scale) this.poke();
    else if (y < this.h * 0.5) this.stars.push(spawnShootingStar(x, y));
  }
}
