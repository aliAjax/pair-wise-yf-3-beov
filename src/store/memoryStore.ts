import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion } from '../utils/constants';
import { generateId } from '../utils/helpers';
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

/** 复访队列中每条记录的附加信息 */
export interface QueueMeta {
  /** 入列时间 */
  queued_at: string;
  /** 替换原因（替换同地点旧记录时必填） */
  reason: string;
  /** 被替换出队列的旧地点（同一地点，留作展示） */
  replaced_location?: string;
}

export interface EnqueueResult {
  ok: boolean;
  /** ok 为 false 时的拒绝原因 */
  error?: 'missing_reason' | 'not_found';
  /** 冲突时队列中已有的同地点记录 id */
  conflictId?: string;
}

interface MemoryStore {
  memories: SmellMemory[];
  /** 复访队列中的记录 id（同地点仅保留一条） */
  queueIds: string[];
  queueMeta: Record<string, QueueMeta>;
  addMemory: (input: MemoryInput) => SmellMemory;
  updateMemory: (id: string, input: MemoryInput) => void;
  deleteMemory: (id: string) => void;
  /** 加入复访队列；同地点已有记录时必须填写替换原因，否则拒绝且队列不变 */
  enqueue: (id: string, reason?: string) => EnqueueResult;
  /** 移出复访队列（记录仍保留在档案中） */
  dequeue: (id: string) => void;
  isQueued: (id: string) => boolean;
  initIfEmpty: () => void;
}

/** 地点归一化：去除首尾空白后比较，避免空格差异绕过同地点约束 */
export function normalizeLocation(location: string): string {
  return location.trim();
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      queueIds: [],
      queueMeta: {},
      addMemory: (input) => {
        const now = new Date().toISOString();
        const newMem: SmellMemory = {
          id: generateId(),
          ...input,
          created_at: now,
          updated_at: now,
        };
        set({ memories: [newMem, ...get().memories] });
        return newMem;
      },
      updateMemory: (id, input) => {
        const { memories, queueIds, queueMeta } = get();
        // 编辑地点后立即与队列同步：若新地点与队列中其他记录撞地点，
        // 该编辑记录（若在队列中）移出队列，保证同地点仅一条
        let nextQueueIds = queueIds;
        let nextQueueMeta = queueMeta;
        if (queueIds.includes(id)) {
          const loc = normalizeLocation(input.location);
          const clash = memories.find(
            (m) => m.id !== id && queueIds.includes(m.id) && normalizeLocation(m.location) === loc,
          );
          if (clash) {
            nextQueueIds = queueIds.filter((qid) => qid !== id);
            const { [id]: _removed, ...rest } = queueMeta;
            void _removed;
            nextQueueMeta = rest;
          }
        }
        set({
          memories: memories.map((m) =>
            m.id === id
              ? { ...m, ...input, updated_at: new Date().toISOString() }
              : m,
          ),
          queueIds: nextQueueIds,
          queueMeta: nextQueueMeta,
        });
      },
      deleteMemory: (id) => {
        // 废弃记录后队列与计数立即同步
        const exists = get().queueIds.includes(id);
        set({
          memories: get().memories.filter((m) => m.id !== id),
          ...(exists
            ? {
                queueIds: get().queueIds.filter((qid) => qid !== id),
                queueMeta: Object.fromEntries(
                  Object.entries(get().queueMeta).filter(([qid]) => qid !== id),
                ),
              }
            : {}),
        });
      },
      enqueue: (id, reason) => {
        const { memories, queueIds, queueMeta } = get();
        const target = memories.find((m) => m.id === id);
        if (!target) return { ok: false, error: 'not_found' };

        const loc = normalizeLocation(target.location);
        const existing = memories.find(
          (m) => m.id !== id && queueIds.includes(m.id) && normalizeLocation(m.location) === loc,
        );

        if (existing) {
          const trimmed = (reason ?? '').trim();
          // 原因缺失：拒绝，队列保持不变
          if (!trimmed) {
            return { ok: false, error: 'missing_reason', conflictId: existing.id };
          }
          const nextMeta: Record<string, QueueMeta> = {};
          for (const [qid, meta] of Object.entries(queueMeta)) {
            if (qid !== existing.id) nextMeta[qid] = meta;
          }
          // 旧记录留在档案中，但移出队列；新记录进入队列
          nextMeta[id] = {
            queued_at: new Date().toISOString(),
            reason: trimmed,
            replaced_location: existing.location,
          };
          set({
            queueIds: [...queueIds.filter((qid) => qid !== existing.id), id],
            queueMeta: nextMeta,
          });
          return { ok: true, conflictId: existing.id };
        }

        if (queueIds.includes(id)) return { ok: true };

        set({
          queueIds: [...queueIds, id],
          queueMeta: {
            ...queueMeta,
            [id]: { queued_at: new Date().toISOString(), reason: (reason ?? '').trim() },
          },
        });
        return { ok: true };
      },
      dequeue: (id) => {
        if (!get().queueIds.includes(id)) return;
        const nextMeta = { ...get().queueMeta };
        delete nextMeta[id];
        set({
          queueIds: get().queueIds.filter((qid) => qid !== id),
          queueMeta: nextMeta,
        });
      },
      isQueued: (id) => get().queueIds.includes(id),
      initIfEmpty: () => {
        if (get().memories.length === 0) {
          // 旧数据默认不在队列
          set({ memories: mockMemories, queueIds: [], queueMeta: {} });
        }
      },
    }),
    {
      name: 'scent-memory-storage',
      storage: createJSONStorage(() => localStorage),
      // 旧版本存档没有 queueIds / queueMeta 字段，合并时补默认值，
      // 使旧数据默认不在队列
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<MemoryStore>;
        return {
          ...current,
          ...p,
          queueIds: Array.isArray(p.queueIds) ? p.queueIds : [],
          queueMeta: p.queueMeta && typeof p.queueMeta === 'object' ? p.queueMeta : {},
        };
      },
    },
  ),
);
