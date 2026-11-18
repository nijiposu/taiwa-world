export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** ストレージが使えない環境（プライベートブラウズ等）でも落ちないように包む */
export const safeStorage = {
  get(store: 'local' | 'session', key: string): string | null {
    try {
      return (store === 'local' ? localStorage : sessionStorage).getItem(key);
    } catch {
      return null;
    }
  },
  set(store: 'local' | 'session', key: string, value: string) {
    try {
      (store === 'local' ? localStorage : sessionStorage).setItem(key, value);
    } catch {
      /* 保存できなくても体験は続ける */
    }
  },
  remove(store: 'local' | 'session', key: string) {
    try {
      (store === 'local' ? localStorage : sessionStorage).removeItem(key);
    } catch {
      /* noop */
    }
  },
};
