/**
 * ちえさんの絵に描かれている灯籠を、絵から切り出して動かす。
 * 1. 灯籠のまわりを、となりの空や水で埋めた「灯籠のない絵」をつくる
 * 2. 灯籠だけをふちをぼかして切り出す
 * 3. 灯籠のない絵の上に、切り出した灯籠をすこしずつずらして描く
 * 座標は絵の画素（1672×941）。
 */
export const PLATE_W = 1672;
export const PLATE_H = 941;

/** 空に浮かぶ灯籠の芯（明るいところ）。大きいものほど手前にある */
const SKY: [number, number, number, number][] = [
  [1303, 83, 1340, 119], [1085, 66, 1115, 95], [1214, 147, 1243, 173], [1143, 34, 1172, 59], [1370, 152, 1396, 176],
  [1062, 262, 1077, 276], [980, 115, 995, 130], [1009, 150, 1024, 163], [1314, 21, 1328, 34], [1012, 301, 1023, 312],
  [1165, 353, 1177, 364], [1100, 382, 1111, 392], [1206, 324, 1216, 334], [1104, 280, 1114, 289], [1151, 144, 1159, 152],
  [1216, 88, 1224, 97], [1256, 68, 1264, 76], [1269, 332, 1278, 340], [1222, 42, 1229, 49], [1062, 313, 1070, 321],
  [1213, 204, 1220, 211], [1133, 171, 1139, 178], [1180, 108, 1186, 115], [869, 169, 875, 175],
];

/** 湖に浮かぶ灯籠（台ごと） */
const WATER: [number, number, number, number][] = [
  [85, 558, 132, 614], [303, 568, 359, 614], [1484, 596, 1574, 682], [1354, 559, 1391, 600],
  [1082, 556, 1113, 592], [1261, 574, 1289, 609], [1139, 575, 1169, 608],
];

export interface MovingLantern {
  sprite: HTMLCanvasElement;
  /** 切り出した場所（絵の画素） */
  x: number;
  y: number;
  w: number;
  h: number;
  water: boolean;
  /** 動きの大きさと速さ */
  amp: number;
  speed: number;
  phase: number;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** ふちを丸くぼかした型 */
function feather(ctx: CanvasRenderingContext2D, w: number, h: number, soft = 0.45) {
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * (0.5 - soft / 2) * 0.9, w / 2, h / 2, Math.max(w, h) * 0.55);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

function brightness(data: Uint8ClampedArray) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
  return sum / (data.length / 4);
}

export function buildLanterns(img: HTMLImageElement) {
  const plate = canvas(PLATE_W, PLATE_H);
  const pctx = plate.getContext('2d', { willReadFrequently: true })!;
  pctx.drawImage(img, 0, 0, PLATE_W, PLATE_H);
  const original = canvas(PLATE_W, PLATE_H);
  original.getContext('2d')!.drawImage(img, 0, 0, PLATE_W, PLATE_H);

  const lanterns: MovingLantern[] = [];
  const boxes = [
    ...SKY.map(([x0, y0, x1, y1]) => {
      const w = x1 - x0;
      const h = y1 - y0;
      return { x: x0 - w * 0.6, y: y0 - h * 0.75, w: w * 2.2, h: h * 2.5, water: false };
    }),
    ...WATER.map(([x0, y0, x1, y1]) => {
      const w = x1 - x0;
      const h = y1 - y0;
      return { x: x0 - w * 0.25, y: y0 - h * 0.25, w: w * 1.5, h: h * 1.45, water: true };
    }),
  ];

  for (const b of boxes) {
    // 灯籠だけを、ふちをぼかして切り出す
    const sprite = canvas(b.w, b.h);
    const sctx = sprite.getContext('2d')!;
    sctx.drawImage(original, b.x, b.y, b.w, b.h, 0, 0, sprite.width, sprite.height);
    feather(sctx, sprite.width, sprite.height, b.water ? 0.35 : 0.5);

    // となりのいちばん暗い所（灯籠のない空・水）で、元の灯籠を埋める
    const offsets = [-2.4, 2.4, -3.6, 3.6, -1.6, 1.6].map((k) => k * b.w);
    let best = offsets[0];
    let bestBright = Infinity;
    for (const dx of offsets) {
      const sx = b.x + dx;
      if (sx < 0 || sx + b.w > PLATE_W) continue;
      const d = pctx.getImageData(Math.round(sx), Math.round(b.y), Math.max(1, Math.round(b.w)), Math.max(1, Math.round(b.h))).data;
      const v = brightness(d);
      if (v < bestBright) {
        bestBright = v;
        best = dx;
      }
    }
    const patch = canvas(b.w, b.h);
    const patchCtx = patch.getContext('2d')!;
    patchCtx.drawImage(original, b.x + best, b.y, b.w, b.h, 0, 0, patch.width, patch.height);
    feather(patchCtx, patch.width, patch.height, 0.6);
    pctx.drawImage(patch, b.x, b.y, b.w, b.h);

    const size = b.w / 40;
    lanterns.push({
      sprite,
      ...b,
      amp: b.water ? 1.6 + size * 1.2 : 4 + size * 9,
      speed: b.water ? 0.6 + Math.random() * 0.3 : 0.12 + Math.random() * 0.12,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return { plate, lanterns };
}
