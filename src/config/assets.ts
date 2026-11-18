import type { WorldId } from '../state/types';

/**
 * 差し替え用の素材設定。
 *
 * 画像や音源を public/assets/<world>/ に置き、ここにパスを書くと反映される。
 * 未指定の項目は、コードで描いた背景・合成音で代わりに表現する。
 *
 * - background: 背景イラスト（指定すると手続き描画の背景を描かず、この画像を敷く）
 * - foreground: 前景イラスト（透過PNG推奨。キャンバス演出の上に重なる）
 * - ambient:    環境音（ループ再生。mp3/ogg など）
 * - logo:       ワールド名の代わりに表示するロゴ画像
 * - thumb:      世界地図で見せる小さな絵
 * - scenes:     イラストを舞台にするワールドの場面画像（名前 → パス）
 *
 * 作品素材（画像・音源）は公開リポジトリに入れていない。
 * 手元に置いていない場合は、色のグラデーションで代わりに表示する。
 */
export interface WorldAssets {
  background?: string;
  foreground?: string;
  ambient?: string;
  logo?: string;
  thumb?: string;
  scenes?: Record<string, string>;
  /** 効果音（名前 → パス）。置いていなければ合成音で鳴らす */
  sfx?: Record<string, string>;
}

export const worldAssets: Record<WorldId, WorldAssets> = {
  campfire: {
    // ナゴリの樹（森の広場・芽の子・焚き火のBGM）から
    ambient: 'assets/campfire/ambient.mp3',
    scenes: {
      hiroba: 'assets/campfire/hiroba.webp',
      gate: 'assets/campfire/gate.webp',
      sit: 'assets/campfire/sprout-sit.webp',
      walk: 'assets/campfire/sprout-walk.webp',
      peek: 'assets/campfire/sprout-peek.webp',
      sleep: 'assets/campfire/sprout-sleep.webp',
    },
    sfx: {
      fire: 'assets/campfire/sfx-fire.mp3',
      bond: 'assets/campfire/sfx-bond.mp3',
      insight: 'assets/campfire/sfx-insight.mp3',
      tap: 'assets/campfire/sfx-tap.mp3',
      fog: 'assets/campfire/sfx-fog.mp3',
    },
  },
  lantern: {
    // ちえさんの「灯籠祭 −心の旅路−」の絵
    scenes: { festival: 'assets/lantern/festival.webp' },
    // ambient: 'assets/lantern/ambient.mp3',
  },
  nagori: {
    // background: 'assets/nagori/background.jpg',
    // ambient: 'assets/nagori/ambient.mp3',
  },
  minasoko: {
    ambient: 'assets/minasoko/ambient.mp3',
    thumb: 'assets/atlas/minasoko.webp',
    scenes: { entrance: 'assets/minasoko/entrance.webp', counter: 'assets/minasoko/counter.webp' },
  },
  bbq: {
    ambient: 'assets/bbq/ambient.mp3',
    thumb: 'assets/atlas/bbq.webp',
    scenes: { plaza: 'assets/bbq/plaza.webp', guide: 'assets/bbq/guide.webp', cardBack: 'assets/bbq/card-person.webp' },
  },
  town: {
    ambient: 'assets/town/ambient.mp3',
    thumb: 'assets/atlas/town.webp',
    scenes: { plaza: 'assets/town/plaza.webp', clock: 'assets/town/clocktower.webp', scrap: 'assets/town/scrapyard.webp' },
  },
};

/** public/ 以下の相対パスを、デプロイ先のベースURLに合わせて解決する */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
