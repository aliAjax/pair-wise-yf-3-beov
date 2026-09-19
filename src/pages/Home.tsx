import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import FilterPanel from '../components/FilterPanel';
import VisualizationPanel from '../components/VisualizationPanel';
import MemoryCard from '../components/MemoryCard';
import MemoryModal from '../components/MemoryModal';
import type { MemorySubmitOptions } from '../components/MemoryModal';
import RevisitQueue from '../components/RevisitQueue';
import { useMemoryStore, normalizeLocation } from '../store/memoryStore';
import type { Filters } from '../utils/helpers';
import { filterMemories, sortRevisitQueue } from '../utils/helpers';
import type { SmellMemory } from '../utils/constants';
import type { MemoryInput } from '../store/memoryStore';
import { BookOpenCheck } from 'lucide-react';

const defaultFilters: Filters = {
  smellType: '',
  season: '',
  emotion: '',
};

export default function Home() {
  const {
    memories,
    queueIds,
    queueMeta,
    initIfEmpty,
    addMemory,
    updateMemory,
    deleteMemory,
    enqueue,
    dequeue,
  } = useMemoryStore();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SmellMemory | null>(null);

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  const filteredMemories = useMemo(
    () => filterMemories(memories, filters),
    [memories, filters],
  );

  // 复访队列：按强度降序、同强度封存时间早者优先；并随当前筛选同步
  const queuedMemories = useMemo(() => {
    const byId = new Map(memories.map((m) => [m.id, m]));
    const queued = queueIds
      .map((id) => byId.get(id))
      .filter((m): m is SmellMemory => !!m);
    return sortRevisitQueue(filterMemories(queued, filters));
  }, [memories, queueIds, filters]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };
  const resetFilters = () => setFilters(defaultFilters);

  const openAddModal = () => { setEditing(null); setModalOpen(true); };
  const openEditModal = (m: SmellMemory) => { setEditing(m); setModalOpen(true); };

  const handleSubmit = (data: MemoryInput, options: MemorySubmitOptions): boolean => {
    if (editing) {
      const wasQueued = queueIds.includes(editing.id);
      updateMemory(editing.id, data);
      if (options.joinQueue) {
        const result = enqueue(editing.id, options.replaceReason);
        if (!result.ok) {
          window.alert(
            result.error === 'missing_reason'
              ? '该地点已在复访队列中，必须填写替换原因才能入列'
              : '入列失败，请重试',
          );
          return false;
        }
      } else if (wasQueued) {
        dequeue(editing.id);
      }
      return true;
    }

    const created = addMemory(data);
    if (options.joinQueue) {
      const result = enqueue(created.id, options.replaceReason);
      if (!result.ok) {
        window.alert(
          result.error === 'missing_reason'
            ? '该地点已在复访队列中，必须填写替换原因才能入列'
            : '入列失败，请重试',
        );
        return false;
      }
    }
    return true;
  };

  const handleDelete = (id: string) => {
    const target = memories.find((m) => m.id === id);
    const inQueue = queueIds.includes(id);
    const msg = `确认删除「${target?.location ?? '这段记忆'}」吗？${inQueue ? '它同时在复访队列中，会一并移出。' : ''}`;
    if (window.confirm(msg)) {
      deleteMemory(id);
      if (expandedId === id) setExpandedId(null);
    }
  };

  const handleToggleQueue = (m: SmellMemory) => {
    if (queueIds.includes(m.id)) {
      dequeue(m.id);
      return;
    }
    const loc = normalizeLocation(m.location);
    const clash = memories.find(
      (x) => x.id !== m.id && queueIds.includes(x.id) && normalizeLocation(x.location) === loc,
    );
    if (clash) {
      const reason = window.prompt(
        `队列中已有同地点记录「${clash.location}」。\n` +
          '旧记录会留在档案中但移出队列，由这条记录取代。\n' +
          '请填写替换原因（必填，留空则取消）：',
      );
      if (reason === null) return;
      const result = enqueue(m.id, reason);
      if (!result.ok && result.error === 'missing_reason') {
        // 原因缺失：拒绝，队列保持不变
        window.alert('替换原因不能为空，已取消入列，队列未改变。');
      }
    } else {
      enqueue(m.id);
    }
  };

  const scrollToCard = (id: string) => {
    setExpandedId(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-memory-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  return (
    <div className="min-h-screen">
      <Header
        onAdd={openAddModal}
        memoryCount={memories.length}
        queueCount={queueIds.length}
      />

      <main className="container max-w-6xl pb-20">
        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onReset={resetFilters}
          resultCount={filteredMemories.length}
        />

        <RevisitQueue
          memories={queuedMemories}
          queueMeta={queueMeta}
          totalCount={queueIds.length}
          onSelect={scrollToCard}
          onDequeue={dequeue}
        />

        <VisualizationPanel memories={filteredMemories} onSelect={scrollToCard} />

        <section className="mt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5" />
              气味档案
            </h2>
            <span className="text-xs text-ink-700/50">
              点击卡片展开完整回忆
            </span>
          </div>

          {filteredMemories.length === 0 ? (
            <div className="bg-paper-50/70 backdrop-blur rounded-3xl border-2 border-dashed border-paper-400 py-20 text-center">
              <div className="text-6xl mb-4 select-none">🍂</div>
              <h3 className="font-serif text-2xl text-ink-800 mb-2">
                {(filters.smellType || filters.season || filters.emotion)
                  ? '没有匹配的气味记忆'
                  : '还没有封存任何气味'}
              </h3>
              <p className="text-ink-700/60 max-w-md mx-auto mb-6">
                {(filters.smellType || filters.season || filters.emotion)
                  ? '换一组筛选条件试试？或者先封存一段新的气味'
                  : '空气中一定有让你难忘的味道——无论是衣柜里的樟木香，还是雨后操场的青草气'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={openAddModal} className="btn-primary">
                  封存第一段气味
                </button>
                {(filters.smellType || filters.season || filters.emotion) && (
                  <button onClick={resetFilters} className="btn-secondary">
                    清除筛选条件
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="masonry-grid">
              {filteredMemories.map((m, idx) => (
                <div key={m.id} data-memory-id={m.id}>
                  <MemoryCard
                    memory={m}
                    index={idx}
                    isExpanded={expandedId === m.id}
                    isQueued={queueIds.includes(m.id)}
                    onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    onEdit={() => openEditModal(m)}
                    onDelete={() => handleDelete(m.id)}
                    onToggleQueue={() => handleToggleQueue(m)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="pb-10 pt-4 text-center text-xs text-ink-700/40 font-hand text-lg">
        <p>愿每一缕气味，都是打开旧时光的钥匙 · Scent Archive</p>
      </footer>

      <MemoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        editingData={editing}
      />
    </div>
  );
}
