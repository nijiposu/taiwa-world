import { REACTIONS } from '../data/reactions';
import { Modal } from './Modal';

export function Help({ onClose, roomId, onChangeSeat }: { onClose: () => void; roomId: string; onChangeSeat: () => void }) {
  return (
    <Modal title="この場所について" onClose={onClose}>
      <div className="prose">
        <p>問いはどの世界でも同じ山札から出ます。世界は、話しやすい空気をつくるための場所です。</p>
        <p>好きなものを持ち寄って、いくつかの世界を訪れながら話す60分です。主役は、人と人との対話。画面は、その時間を少しだけ豊かにするためのものです。</p>
        <h4>声について</h4>
        <p>声はZoomやGoogle Meetでつないでください。顔出しは不要です。</p>
        <h4>リアクション</h4>
        <ul>
          {REACTIONS.map((r) => (
            <li key={r.id}>
              {r.emoji} {r.label}
            </li>
          ))}
        </ul>
        <p>話をさえぎらずに気持ちを伝えられます。「✋ 私も話したい」は順番待ちに並び、ホストに届きます。</p>
        <h4>世界で遊ぶ（🗺️ 地図からどこへでも）</h4>
        <ul>
          <li>樹の下の焚き火：焚き火や夜空に触れてみて。ここが集合場所です</li>
          <li>ナゴリの樹：幹に触れると問い、葉にことばを残せます</li>
          <li>灯籠祭：湖と鳥居。空や水面に触れてみて</li>
        </ul>
        <p className="muted">ルーム：{roomId}（試作版のため、同じブラウザの別タブ同士でだけ同期します）</p>
        <button className="btn btn--ghost btn--small" onClick={onChangeSeat}>
          席・名前を変える
        </button>
      </div>
    </Modal>
  );
}
