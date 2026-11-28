import { safeStorage } from './state/util';

type StatEvent = 'visit' | 'trial' | 'enter' | 'travel' | 'voice' | 'record' | 'play';

/**
 * どこから来たか。URL の ?from=note などがあればそれ、なければ前のページのサイト名。
 * 開いている間は覚えておく（あとのできごとにも同じ入り口をつける）。
 */
export function source(): string {
  const saved = safeStorage.get('session', 'taiwa:from');
  if (saved) return saved;
  const from = new URLSearchParams(location.search).get('from');
  let src = from ? from.slice(0, 30) : '';
  if (!src && document.referrer) {
    try {
      const host = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (host !== location.hostname) src = host;
    } catch {
      /* 読めない referrer は無視 */
    }
  }
  src ||= '直接（リンク・ブックマーク）';
  safeStorage.set('session', 'taiwa:from', src);
  return src;
}

/** できごとを1つ数える。失敗しても画面には何もしない */
export function track(event: StatEvent, detail = '') {
  if (import.meta.env.DEV) return;
  try {
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, detail }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* noop */
  }
}
