import type { WorldId } from '../state/types';

// アプリ全体の表示設定。名称が決まったらここを書き換える。
export const APP_TITLE = '世界をめぐる対話の場';
export const APP_SUBTITLE = '好きなものを持ち寄り、さまざまな世界を訪れながら対話する60分';
export const SESSION_MINUTES = 60;

/**
 * いま開いているワールド。まずは小さく、この3か所から。
 * 水底郵便局（minasoko）・才能BBQ（bbq）・やりたいことが消えた町（town）は作ってあるので、
 * ここに足せば地図に戻ってくる。
 */
export const OPEN_WORLDS: WorldId[] = ['campfire', 'nagori', 'lantern'];

/** お試しモード（?try）：開いた人ごとに自分だけの部屋。進行メニューは出さない */
export const TRIAL = typeof location !== 'undefined' && new URLSearchParams(location.search).has('try');
