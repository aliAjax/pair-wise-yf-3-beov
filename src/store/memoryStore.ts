import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion } from '../utils/constants';
import { generateId, isSameLocation } from '../utils/helpers';
import { mockMemories } from '../data/mockData';

export interface MemoryInput {
  location: string;
  source_guess: string;
  intensity: number;
  humidity: number;
  season: Season;
  smell_type: SmellType;
  memory_text: string;
  color_association: string;
  emotion: Emotion;
  want_again: boolean;
}

export type EnqueueResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'not-found' };

interface MemoryStore {
  memories: SmellMemory[];
  addMemory: (input: MemoryInput) => void;
  updateMemory: (id: string, input: MemoryInput, replaceReason?: string) => void;
  deleteMemory: (id: string) => void;
  /**
   * 将记录加入复访队列。同地点队列中只能保留一条：
   * 若已有同地点的在队记录（非自身），必须填写替换原因；
   * 原因缺失则拒绝且队列不变；
   * 成功时旧记录留在档案中但移出队列，目标记录进入队列。
   */
  enqueue: (id: string, replaceReason?: string) => EnqueueResult;
  /** 移出复访队列，记录仍保留在档案中 */
  dequeue: (id: string) => void;
  initIfEmpty: () => void;
}

const outOfQueue = (m: SmellMemory): SmellMemory => ({
  ...m,
  in_queue: false,
  replace_reason: null,
});

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      addMemory: (input) => {
        const now = new Date().toISOString();
        const newMem: SmellMemory = {
          id: generateId(),
          ...input,
          created_at: now,
          updated_at: now,
          // 新封存的气味默认不进复访队列，需要用户手动加入
          in_queue: false,
        };
        set({ memories: [newMem, ...get().memories] });
      },
      updateMemory: (id, input, replaceReason) => {
        const target = get().memories.find((m) => m.id === id);
        if (!target) return;

        // 编辑地点后立即同步队列：若新地点已被另一条在队记录占用，
        // 填了替换原因则顶掉对方，否则本条自动出队。
        let inQueue = target.in_queue ?? false;
        let reason: string | null | undefined = target.replace_reason ?? null;
        if (inQueue && !isSameLocation(target.location, input.location)) {
          const occupant = get().memories.find(
            (m) => m.id !== id && m.in_queue && isSameLocation(m.location, input.location),
          );
          if (occupant) {
            const trimmed = replaceReason?.trim();
            if (trimmed) {
              reason = trimmed;
            } else {
              inQueue = false;
              reason = null;
            }
          } else {
            // 地点变了但不涉及替换，历史替换原因不再适用
            reason = null;
          }
        }

        const now = new Date().toISOString();
        set({
          memories: get().memories.map((m) => {
            if (m.id === id) {
              return { ...m, ...input, updated_at: now, in_queue: inQueue, replace_reason: reason };
            }
            // 替换成功（被编辑记录原本在队、改地点后仍在队列且给出了替换原因）：
            // 被替换的旧记录留在档案中，但移出队列；
            // 未给原因时被编辑记录自身出列，占用者保持不动
            if (
              inQueue &&
              target.in_queue &&
              isSameLocation(target.location, input.location) === false &&
              replaceReason?.trim() &&
              m.in_queue &&
              isSameLocation(m.location, input.location)
            ) {
              return outOfQueue(m);
            }
            return m;
          }),
        });
      },
      deleteMemory: (id) => {
        set({ memories: get().memories.filter((m) => m.id !== id) });
      },
      enqueue: (id, replaceReason) => {
        const target = get().memories.find((m) => m.id === id);
        if (!target) return { ok: false, reason: 'not-found' };

        const occupant = get().memories.find(
          (m) => m.id !== id && m.in_queue && isSameLocation(m.location, target.location),
        );

        if (occupant && !replaceReason?.trim()) {
          // 原因缺失，拒绝且队列不变
          return { ok: false, reason: 'missing' };
        }

        set({
          memories: get().memories.map((m) => {
            if (m.id === id) {
              return {
                ...m,
                in_queue: true,
                replace_reason: occupant ? replaceReason!.trim() : null,
              };
            }
            // 旧记录留在档案中，但移出队列
            if (occupant && m.id === occupant.id) return outOfQueue(m);
            return m;
          }),
        });
        return { ok: true };
      },
      dequeue: (id) => {
        set({
          memories: get().memories.map((m) =>
            m.id === id && m.in_queue ? outOfQueue(m) : m,
          ),
        });
      },
      initIfEmpty: () => {
        if (get().memories.length === 0) {
          set({ memories: mockMemories });
        }
      },
    }),
    {
      name: 'scent-memory-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
