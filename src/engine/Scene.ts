/**
 * キャンバス演出の土台。
 * - 端末のピクセル比に合わせたリサイズ
 * - 背景（重い描画）をオフスクリーンにキャッシュ
 * - タブが隠れている間はループを止める
 * - 「視差効果を減らす」設定の人には粒子を控えめにする
 */
export abstract class Scene {
  protected ctx: CanvasRenderingContext2D;
  protected w = 0;
  protected h = 0;
  protected dpr = 1;
  protected t = 0;
  protected backdrop: HTMLCanvasElement | null = null;
  protected readonly reducedMotion: boolean;
  /** 背景画像が差し替え素材で指定されていれば、手続き描画の背景を省く */
  protected drawBackdrop = true;
  private raf = 0;
  private last = 0;
  private running = false;
  private observer: ResizeObserver;

  constructor(protected canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D が使えません');
    this.ctx = ctx;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  setBackdropEnabled(enabled: boolean) {
    this.drawBackdrop = enabled;
    this.renderBackdrop();
  }

  /** 粒子の量の係数。小さい画面・省モーション設定で減らす */
  protected get density() {
    const area = Math.min(1.4, (this.w * this.h) / (1280 * 800));
    return (this.reducedMotion ? 0.35 : 1) * Math.max(0.45, area);
  }

  start() {
    this.resize();
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else if (this.running) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
  };

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.backdrop) ctx.drawImage(this.backdrop, 0, 0, this.w, this.h);
    this.frame(dt);
    if (this.running) this.raf = requestAnimationFrame(this.loop);
  };

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.layout();
    this.renderBackdrop();
  }

  private renderBackdrop() {
    if (this.w === 0) return;
    if (!this.drawBackdrop) {
      this.backdrop = null;
      return;
    }
    const off = this.backdrop ?? document.createElement('canvas');
    off.width = Math.round(this.w * this.dpr);
    off.height = Math.round(this.h * this.dpr);
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.paintBackdrop(octx);
    this.backdrop = off;
  }

  /** 画面サイズが変わったときに位置関係を計算し直す */
  protected layout() {}
  /** 動かない背景を一度だけ描く */
  protected abstract paintBackdrop(ctx: CanvasRenderingContext2D): void;
  /** 毎フレームの描画 */
  protected abstract frame(dt: number): void;

  /**
   * 画面上のポインタ座標（要素基準の px）を受け取る。
   * 意味のある場所に触れたときは、その名前を返す（例：'trunk'）。
   */
  pointer(_x: number, _y: number, _kind: 'move' | 'down'): string | void {}
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** 決まった種から同じ乱数列を作る（背景の木や星を毎回同じ配置にする） */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** なめらかに揺らぐ値（焚き火のゆらぎなど） */
export function flicker(t: number, seed = 0) {
  return (
    Math.sin(t * 7.3 + seed) * 0.35 +
    Math.sin(t * 13.1 + seed * 2.1) * 0.22 +
    Math.sin(t * 2.7 + seed * 0.7) * 0.43
  );
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: number;
  sat?: number;
  light?: number;
  seed: number;
  kind?: number;
}

export function stepParticles(list: Particle[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list[i] = list[list.length - 1];
      list.pop();
    }
  }
}

export function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, seed: number, maxY = 0.6) {
  const r = seeded(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * w;
    const y = Math.pow(r(), 1.4) * h * maxY;
    const s = r() * r() * 1.6 + 0.3;
    ctx.globalAlpha = 0.25 + r() * 0.7;
    ctx.fillStyle = r() > 0.85 ? '#ffe9c9' : '#dfe8ff';
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export interface Twinkle {
  x: number;
  y: number;
  s: number;
  p: number;
  sp: number;
}

export function makeTwinkles(w: number, h: number, count: number, seed: number, maxY = 0.55): Twinkle[] {
  const r = seeded(seed);
  return Array.from({ length: count }, () => ({
    x: r() * w,
    y: Math.pow(r(), 1.3) * h * maxY,
    s: 0.6 + r() * 1.4,
    p: r() * Math.PI * 2,
    sp: 0.6 + r() * 2.2,
  }));
}

export function drawTwinkles(ctx: CanvasRenderingContext2D, list: Twinkle[], t: number) {
  ctx.fillStyle = '#fff6e6';
  for (const s of list) {
    const a = 0.5 + 0.5 * Math.sin(t * s.sp + s.p);
    ctx.globalAlpha = a * a * 0.9;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.s * (0.6 + a * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 流れ星。夜空をクリックしたときの小さなご褒美 */
export interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export function spawnShootingStar(x: number, y: number): ShootingStar {
  const dir = Math.random() > 0.5 ? 1 : -1;
  return { x, y, vx: dir * rand(380, 560), vy: rand(150, 240), life: 0.9 };
}

export function drawShootingStars(ctx: CanvasRenderingContext2D, list: ShootingStar[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    s.life -= dt;
    if (s.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const a = Math.min(1, s.life * 2);
    const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.18, s.y - s.vy * 0.18);
    g.addColorStop(0, `rgba(255,250,235,${a})`);
    g.addColorStop(1, 'rgba(255,250,235,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 0.18, s.y - s.vy * 0.18);
    ctx.stroke();
  }
}
