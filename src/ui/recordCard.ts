import { APP_TITLE } from '../config/app';
import { assetUrl, worldAssets } from '../config/assets';
import { REACTIONS } from '../data/reactions';
import { displayName } from '../data/seats';
import { WORLDS } from '../data/worlds';
import { EMPTY_RECORD } from '../state/reducer';
import type { SeatId, SessionState, WorldId } from '../state/types';

/** 記録カードに写す、そのワールドの絵 */
export function worldPicture(world: WorldId): string | undefined {
  const a = worldAssets[world];
  const s = a.scenes ?? {};
  return s.hiroba ?? s.village ?? s.festival ?? s.entrance ?? s.plaza ?? a.thumb;
}

export function dateLabel(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 記録カードに載せる中身をまとめる */
export function recordSummary(state: SessionState, seat: SeatId) {
  const rec = state.records[seat] ?? EMPTY_RECORD;
  const worlds = [...new Set(state.visited.map((v) => v.world))];
  const words = [...state.leaves, ...state.lanterns].filter((k) => k.seat === seat && k.text).map((k) => k.text);
  const sent = REACTIONS.map((r) => ({ ...r, count: state.reactions.filter((e) => e.seat === seat && e.reaction === r.id).length })).filter(
    (r) => r.count > 0,
  );
  return {
    name: displayName(state.participants[seat]?.name, seat),
    avatar: state.participants[seat]?.avatar,
    date: dateLabel(state.startedAt ?? Date.now()),
    theme: state.theme,
    worlds: worlds.length ? worlds : (['campfire'] as WorldId[]),
    words,
    sent,
    rec,
  };
}

function load(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 文字を幅に合わせて折り返す（日本語なので1文字ずつ） */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > width) {
        lines.push(line);
        line = ch;
      } else line += ch;
    }
    lines.push(line);
  }
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].slice(0, -1) + '…';
    return cut;
  }
  return lines;
}

/**
 * 持ち帰り用の記録カードを、1080×1350 の画像にする（スマホに保存しやすい縦長）。
 */
export async function renderRecordCard(state: SessionState, seat: SeatId): Promise<Blob | null> {
  const sum = recordSummary(state, seat);
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  try {
    await Promise.all([document.fonts.load('48px "Zen Old Mincho"'), document.fonts.load('28px "Zen Kaku Gothic New"')]);
  } catch {
    /* 字体が読めなくても描く */
  }
  const serif = '"Zen Old Mincho", "Hiragino Mincho ProN", serif';
  const sans = '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif';

  // 背景：最初に訪れたワールドの絵を、暗く敷く
  const bgSrc = worldPicture(sum.worlds[0]);
  const bg = bgSrc ? await load(assetUrl(bgSrc)) : null;
  if (bg) {
    const k = Math.max(W / bg.width, H / bg.height);
    ctx.drawImage(bg, (W - bg.width * k) / 2, (H - bg.height * k) / 2, bg.width * k, bg.height * k);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a1d4a');
    g.addColorStop(1, '#120c1c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(14,10,24,0.55)';
  ctx.fillRect(0, 0, W, H);

  // 紙
  const px = 70;
  const py = 70;
  const pw = W - px * 2;
  const ph = H - py * 2;
  ctx.fillStyle = 'rgba(252,246,232,0.95)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,150,90,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(px + 14, py + 14, pw - 28, ph - 28, 20);
  ctx.stroke();

  let y = py + 70;
  const x = px + 60;
  const inner = pw - 120;

  // 見出し
  ctx.fillStyle = '#9a6b3a';
  ctx.font = `26px ${sans}`;
  ctx.fillText(`${sum.date}　${APP_TITLE}`, x, y);
  y += 86;
  // アイコン
  const avatarSrc = sum.avatar?.startsWith('img:') ? assetUrl(`assets/nagori-ui/face-${sum.avatar.slice(4)}.webp`) : null;
  const face = avatarSrc ? await load(avatarSrc) : null;
  if (face) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 44, y - 16, 44, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(face, x, y - 60, 88, 88);
    ctx.restore();
  } else if (sum.avatar) {
    ctx.font = `64px ${sans}`;
    ctx.fillText(sum.avatar, x, y + 6);
  }
  ctx.fillStyle = '#3a2a1e';
  ctx.font = `52px ${serif}`;
  ctx.fillText(`${sum.name}さんの、今日の記録`, x + 110, y);
  y += 60;

  // 訪れたワールドの絵
  const thumbs = await Promise.all(sum.worlds.slice(0, 3).map(async (w) => ({ w, img: worldPicture(w) ? await load(assetUrl(worldPicture(w)!)) : null })));
  const tw = (inner - 20 * (thumbs.length - 1)) / thumbs.length;
  const th = 170;
  thumbs.forEach(({ w, img }, i) => {
    const tx = x + i * (tw + 20);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(tx, y, tw, th, 16);
    ctx.clip();
    if (img) {
      const k = Math.max(tw / img.width, th / img.height);
      ctx.drawImage(img, tx + (tw - img.width * k) / 2, y + (th - img.height * k) / 2, img.width * k, img.height * k);
    } else {
      ctx.fillStyle = '#5a4a7a';
      ctx.fillRect(tx, y, tw, th);
    }
    const g = ctx.createLinearGradient(0, y + th * 0.5, 0, y + th);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = g;
    ctx.fillRect(tx, y, tw, th);
    ctx.restore();
    ctx.fillStyle = '#fff6e4';
    ctx.font = `26px ${serif}`;
    ctx.fillText(WORLDS[w].name, tx + 16, y + th - 18);
  });
  y += th + 56;

  const section = (label: string, body: string, maxLines: number) => {
    if (!body.trim()) return;
    ctx.fillStyle = '#9a6b3a';
    ctx.font = `24px ${sans}`;
    ctx.fillText(label, x, y);
    y += 44;
    ctx.fillStyle = '#3a2a1e';
    ctx.font = `30px ${serif}`;
    for (const line of wrap(ctx, body, inner, maxLines)) {
      ctx.fillText(line, x, y);
      y += 44;
    }
    y += 22;
  };

  if (sum.theme) section('今日のテーマ', sum.theme, 1);
  section('持ち寄った作品', sum.rec.works, 2);
  if (sum.words.length) section('残したことば', sum.words.map((w) => `「${w}」`).join('　'), 3);
  section('話して感じたこと', sum.rec.feelings, 3);
  section('価値観についての気づき', sum.rec.insights, 3);

  // 送ったリアクション
  if (sum.sent.length && y < py + ph - 260) {
    ctx.fillStyle = '#9a6b3a';
    ctx.font = `24px ${sans}`;
    ctx.fillText('みんなに届けたもの', x, y);
    y += 46;
    ctx.fillStyle = '#3a2a1e';
    ctx.font = `28px ${sans}`;
    ctx.fillText(sum.sent.map((r) => `${r.emoji} ${r.label} ×${r.count}`).join('　'), x, y);
    y += 56;
  }

  // ファシリテーターからのひとこと（ふせんのように）
  if (sum.rec.feedback.trim()) {
    ctx.font = `28px ${serif}`;
    const lines = wrap(ctx, sum.rec.feedback, inner - 60, 4);
    const nh = 70 + lines.length * 42;
    const ny = Math.min(y, py + ph - nh - 40);
    ctx.save();
    ctx.translate(x + 10, ny);
    ctx.rotate(-0.012);
    ctx.fillStyle = 'rgba(255,236,190,0.95)';
    ctx.fillRect(0, 0, inner - 20, nh);
    ctx.fillStyle = '#9a6b3a';
    ctx.font = `22px ${sans}`;
    ctx.fillText('ファシリテーターから', 30, 40);
    ctx.fillStyle = '#3a2a1e';
    ctx.font = `28px ${serif}`;
    lines.forEach((l, i) => ctx.fillText(l, 30, 84 + i * 42));
    ctx.restore();
  }

  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}
