import type { WorldId } from '../state/types';

export interface WorldInfo {
  id: WorldId;
  name: string;
  subtitle: string;
  host: string;
  description: string;
  /** 移動時のベールや UI のアクセント */
  accent: string;
  veil: string;
}

export const WORLDS: Record<WorldId, WorldInfo> = {
  campfire: {
    id: 'campfire',
    name: '樹の下の焚き火',
    subtitle: 'はじまりと、おかえりの場所',
    host: '集合場所',
    description: 'ナゴリの樹のふもとで、焚き火がゆっくり揺れている。ここから好きな世界へ出かけよう。',
    accent: '#f0a35a',
    veil: '#120a06',
  },
  lantern: {
    id: 'lantern',
    name: '灯籠祭',
    subtitle: '−心の旅路−',
    host: '',
    description: '星空と夕焼けの湖に、鳥居が静かに立っている。続きは、ちえさんの作品で。',
    accent: '#ff8f6b',
    veil: '#0b0a1f',
  },
  nagori: {
    id: 'nagori',
    name: 'ナゴリの樹',
    subtitle: 'ことばが葉になる場所',
    host: '',
    description: '大きな樹が根をひろげ、やわらかな光が舞う。触れると、問いが芽吹く。',
    accent: '#9fe0b4',
    veil: '#06120f',
  },
  minasoko: {
    id: 'minasoko',
    name: '水底郵便局',
    subtitle: 'まだ届いていない手紙があります',
    host: '水のエリア',
    description: '海の底の小さな郵便局。くらげの灯りの下で、封筒から次の問いが届く。',
    accent: '#7ec8ff',
    veil: '#050c22',
  },
  bbq: {
    id: 'bbq',
    name: '才能BBQ',
    subtitle: 'その行動、何を焼いている？',
    host: 'BBQ広場',
    description: 'にぎやかな夜のBBQ広場。炭火を囲んで、好きなものをじっくり焼くように話す。',
    accent: '#ffb35c',
    veil: '#150b10',
  },
  town: {
    id: 'town',
    name: 'やりたいことが消えた町',
    subtitle: 'ここでは誰もが「別に普通です」としか言えない',
    host: '時計塔の町',
    description: '色をなくした時計塔の町。対話で出た「好き」が、町に色を取り戻していく。',
    accent: '#c9a6ff',
    veil: '#0e0a1c',
  },
};

export const WORLD_ORDER: WorldId[] = ['campfire', 'nagori', 'lantern', 'minasoko', 'bbq', 'town'];
