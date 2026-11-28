import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index';

/** 数えるできごと。中身は匿名の回数だけで、誰が・どこからのIPかは残さない */
export const EVENTS = ['visit', 'trial', 'enter', 'travel', 'voice', 'record', 'play'] as const;
export type StatEvent = (typeof EVENTS)[number];

const LABEL: Record<StatEvent, string> = {
  visit: '開いた（入室画面）',
  trial: 'お試しで入った',
  enter: '本番の部屋に入った',
  travel: 'ワールドへ移動',
  voice: '声で参加',
  record: '記録カードを保存',
  play: '焚き火あそび',
};

const DAY_MS = 86_400_000;

function jstDate(ts = Date.now()) {
  return new Date(ts + 9 * 3_600_000).toISOString().slice(0, 10);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * アクセスの集計（サイト全体で1つだけ動く）。
 * 日付 × できごと × くわしさ（どこから来たか・どのワールドか など）ごとに回数を数える。
 */
export class Stats extends DurableObject<Env> {
  async add(event: StatEvent, detail: string) {
    const key = `${jstDate()}|${event}|${detail}`;
    const n = ((await this.ctx.storage.get<number>(key)) ?? 0) + 1;
    await this.ctx.storage.put(key, n);
  }

  async page(days: number): Promise<string> {
    const since = jstDate(Date.now() - (days - 1) * DAY_MS);
    const all = await this.ctx.storage.list<number>({ start: since });
    const total = new Map<string, number>();
    const byDay = new Map<string, Map<StatEvent, number>>();
    const detail = new Map<StatEvent, Map<string, number>>();
    for (const [key, n] of all) {
      const [day, ev, d] = key.split('|') as [string, StatEvent, string];
      total.set(ev, (total.get(ev) ?? 0) + n);
      if (!byDay.has(day)) byDay.set(day, new Map());
      byDay.get(day)!.set(ev, (byDay.get(day)!.get(ev) ?? 0) + n);
      if (!detail.has(ev)) detail.set(ev, new Map());
      detail.get(ev)!.set(d, (detail.get(ev)!.get(d) ?? 0) + n);
    }
    const rows = (m?: Map<string, number>) =>
      [...(m ?? new Map()).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `<tr><td>${esc(k || '（なし）')}</td><td class="n">${n}</td></tr>`)
        .join('') || '<tr><td colspan="2" class="muted">まだありません</td></tr>';
    const days2 = [...byDay.keys()].sort().reverse();
    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>アクセスのようす</title><meta name="robots" content="noindex">
<style>
body{margin:0;padding:24px 16px 60px;background:#120e1c;color:#f4ece0;font-family:"Hiragino Sans","Noto Sans JP",sans-serif}
main{max-width:860px;margin:0 auto}h1{font-weight:500;letter-spacing:.1em}h2{margin:32px 0 8px;font-size:16px;color:#f3b06b}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.card{padding:14px;border-radius:14px;background:rgba(255,255,255,.06)}.card b{display:block;font-size:28px}.card small{color:#bbb}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}
.n{text-align:right;font-variant-numeric:tabular-nums}.muted{color:#999}nav a{color:#f3b06b;margin-right:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}
</style></head><body><main>
<h1>アクセスのようす</h1>
<nav>期間：<a href="?days=7">7日</a><a href="?days=30">30日</a><a href="?days=90">90日</a>（いま ${days}日・日本時間）</nav>
<p class="muted">匿名の回数だけを数えています。だれが見たかや、IPアドレスは残していません。</p>
<div class="cards">${EVENTS.map((e) => `<div class="card"><b>${total.get(e) ?? 0}</b><small>${LABEL[e]}</small></div>`).join('')}</div>
<div class="grid">
<section><h2>どこから来たか（開いた数）</h2><table>${rows(detail.get('visit'))}</table></section>
<section><h2>お試しの入り口</h2><table>${rows(detail.get('trial'))}</table></section>
<section><h2>行かれたワールド</h2><table>${rows(detail.get('travel'))}</table></section>
<section><h2>本番の部屋に入った席</h2><table>${rows(detail.get('enter'))}</table></section>
<section><h2>焚き火あそび</h2><table>${rows(detail.get('play'))}</table></section>
</div>
<h2>日ごと</h2><table><tr><th>日付</th>${EVENTS.map((e) => `<th class="n">${LABEL[e]}</th>`).join('')}</tr>
${days2.map((d) => `<tr><td>${d}</td>${EVENTS.map((e) => `<td class="n">${byDay.get(d)?.get(e) ?? 0}</td>`).join('')}</tr>`).join('') || '<tr><td class="muted">まだありません</td></tr>'}
</table></main></body></html>`;
  }
}
