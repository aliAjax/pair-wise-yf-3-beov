import { ListChecks, Crosshair, LogOut } from 'lucide-react';
import type { SmellMemory } from '../utils/constants';
import { getSmellTypeInfo } from '../utils/constants';
import { formatDate } from '../utils/helpers';

interface Props {
  queue: SmellMemory[];
  onLocate: (id: string) => void;
  onDequeue: (id: string) => void;
}

export default function RevisitQueue({ queue, onLocate, onDequeue }: Props) {
  return (
    <section className="container max-w-6xl mb-6">
      <div className="bg-paper-50/70 backdrop-blur rounded-2xl border border-ochre-300/60 p-4 md:p-5 shadow-paper">
        <div className="flex items-center gap-2 mb-1">
          <ListChecks className="w-5 h-5 text-ochre-600" />
          <span className="font-hand text-xl text-ochre-600">复访队列</span>
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-ochre-500 text-paper-50 text-xs font-semibold">
            {queue.length}
          </span>
          <span className="text-xs text-ink-700/50">· 同地点仅保留一条，按强度排序</span>
        </div>

        {queue.length === 0 ? (
          <p className="text-sm text-ink-700/50 py-3">
            队列为空——展开任意气味卡片，点击「加入复访」，把想再去闻一次的地点排进来吧
          </p>
        ) : (
          <ol className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
            {queue.map((m, idx) => {
              const stype = getSmellTypeInfo(m.smell_type);
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-paper-100/70 border border-paper-200/80 animate-fadeInUp"
                  style={{ animationDelay: `${Math.min(idx * 50, 400)}ms` }}
                >
                  <div className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center bg-ochre-100 text-ochre-700 font-serif font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: stype.color }}>{stype.emoji}</span>
                      <span className="text-sm font-medium text-ink-800 truncate">{m.location}</span>
                      <span className="shrink-0 text-xs font-semibold text-ochre-600">
                        强度 {m.intensity}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-700/55 truncate">
                      {m.replace_reason
                        ? `替换原因：${m.replace_reason}`
                        : `封存于 ${formatDate(m.created_at)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onLocate(m.id)}
                      title="定位到档案卡片"
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-moss-600 hover:bg-moss-100 transition-colors"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">定位</span>
                    </button>
                    <button
                      onClick={() => onDequeue(m.id)}
                      title="移出队列（保留档案）"
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-ink-700/70 hover:bg-paper-200 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">移出</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
