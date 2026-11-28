import { Room } from './room';
import { EVENTS, Stats, type StatEvent } from './stats';

export { Room, Stats };

export interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace<Room>;
  STATS: DurableObjectNamespace<Stats>;
}

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/[^\p{L}\p{N}._:\-/ ]/gu, '').slice(0, 40) : '');

const ROOM_PATH = /^\/api\/room\/([\w-]{1,32})$/;

/**
 * 入口。/api/room/<部屋名> は部屋サーバー（Durable Object）へ、それ以外は画面のファイルを返す。
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(ROOM_PATH);
    if (match) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket only', { status: 426 });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
      return stub.fetch(request);
    }
    // アクセスの集計：できごとを1つ数える（匿名の回数だけ）
    if (url.pathname === '/api/track' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { event?: string; detail?: string };
        if (EVENTS.includes(body.event as StatEvent)) {
          const stub = env.STATS.get(env.STATS.idFromName('all'));
          await stub.add(body.event as StatEvent, clean(body.detail));
        }
      } catch {
        /* 壊れた送信は数えない */
      }
      return new Response(null, { status: 204 });
    }
    // 集計を見るページ
    if (url.pathname === '/api/stats') {
      const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30));
      const html = await env.STATS.get(env.STATS.idFromName('all')).page(days);
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
