/** object-fit: cover と同じ計算で、絵が画面のどこに置かれるかを求める */
export function coverRect(w: number, h: number, aspect: number) {
  const scale = Math.max(w / aspect, h);
  const iw = scale * aspect;
  const ih = scale;
  return { x: (w - iw) / 2, y: (h - ih) / 2, w: iw, h: ih };
}

/** 絵の中の位置（0..1）を、画面上の px に変える */
export function coverPoint(w: number, h: number, aspect: number, u: number, v: number) {
  const r = coverRect(w, h, aspect);
  return { x: r.x + u * r.w, y: r.y + v * r.h };
}
