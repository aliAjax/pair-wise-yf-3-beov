import type { SmellMemory } from '../utils/constants';
import { getSmellTypeInfo, getSeasonInfo } from '../utils/constants';
import { formatDate, contrastTextColor } from '../utils/helpers';
import type { QueueMeta } from '../store/memoryStore';
import { CalendarClock, X, ArrowRight } from 'lucide-react';

interface Props {
  /** 已按队列规则排好序、且经过当前筛选的记录 */
  memories: SmellMemory[];
  queueMeta: Record<string, QueueMeta>;
  /** 队列总条数（未经筛选），用于计数展示 */
  totalCount: number;
  onSelect: (id: string) => void;
  onDequeue: (id: string) => void;
}

export default function RevisitQueue({ memories, queueMeta, totalCount, onSelect, onDequeue }: Props) {
  if (totalCount === 0) return null;

  return (
    <section className="container max-w-6xl mb-8">
      <div className="bg-paper-50/80 backdrop-blur rounded-2xl border-2 border-lavender-300/50 p-4 md:p-5 shadow-paper">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="font-hand text-2xl text-lavender-600 flex items-center gap-2">
            <CalendarClock className="w-5 h-5" />
            复访队列
          </h2>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-lavender-300/30 text-lavender-600 text-xs font-semibold border border-lavender-300/50">
            {memories.length === totalCount
              ? `${totalCount} 条待复访`
              : `${memories.length} / ${totalCount} 条匹配筛选`}
          </span>
        </div>
        <p className="text-xs text-ink-700/50 mb-4">
          按气味强度从高到低排列，强度相同则封存时间早者优先 · 同一地点队列中只保留最新一条
        </p>

        {memories.length === 0 ? (
          <div className="text-center py-8 text-ink-700/40 text-sm">
            队列中有 {totalCount} 条记录，但都不符合当前筛选条件
          </div>
        ) : (
          <ul className="space-y-2">
            {memories.map((m, idx) => {
              const stype = getSmellTypeInfo(m.smell_type);
              const season = getSeasonInfo(m.season);
              const meta = queueMeta[m.id];
              return (
                <li
                  key={m.id}
                  className="group flex items-center gap-3 p-2.5 rounded-xl bg-paper-100/70 hover:bg-paper-200/70 border border-paper-200/60 transition-all duration-200"
                >
                  <div className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-sm font-serif font-bold text-lavender-600 bg-lavender-300/25">
                    {idx + 1}
                  </div>
                  <div
                    className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center shadow-sm"
                    style={{
                      backgroundColor: m.color_association,
                      color: contrastTextColor(m.color_association),
                    }}
                  >
                    <span className="text-sm">{stype.emoji}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelect(m.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{season.emoji}</span>
                      <span className="text-sm font-medium text-ink-800 truncate">{m.location}</span>
                      <span className="shrink-0 text-[10px] text-ink-700/45">
                        封存于 {formatDate(m.created_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-700/60 min-w-0">
                      <span className="shrink-0 font-semibold text-ochre-600">强度 {m.intensity}/10</span>
                      {meta?.reason && (
                        <span className="truncate">
                          {meta.replaced_location && (
                            <span className="text-lavender-600">
                              替换「{meta.replaced_location}」
                              <ArrowRight className="inline w-3 h-3 mx-0.5" />
                            </span>
                          )}
                          {meta.reason}
                        </span>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDequeue(m.id)}
                    title="移出复访队列（记录仍保留在档案中）"
                    className="shrink-0 p-2 rounded-lg text-ink-700/40 hover:text-brick-600 hover:bg-brick-500/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
