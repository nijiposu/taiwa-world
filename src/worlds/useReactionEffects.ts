import { sound } from '../audio/sound';
import { useActionEffect } from '../state/RoomContext';
import type { ReactionId, WorldId } from '../state/types';

/** 誰かがリアクションしたら、いま居るワールドに合った演出を起こす */
export function useReactionEffects(world: WorldId, scene: { reaction(id: ReactionId): void } | null) {
  useActionEffect((action) => {
    if (action.type !== 'react' || action.event.world !== world || !scene) return;
    scene.reaction(action.event.reaction);
    sound.pop(action.event.reaction === 'speak' ? 1.3 : 1);
  });
}
