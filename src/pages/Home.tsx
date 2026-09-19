import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import FilterPanel from '../components/FilterPanel';
import VisualizationPanel from '../components/VisualizationPanel';
import MemoryCard from '../components/MemoryCard';
import MemoryModal from '../components/MemoryModal';
import RevisitQueue from '../components/RevisitQueue';
import { useMemoryStore } from '../store/memoryStore';
import type { Filters } from '../utils/helpers';
import { filterMemories, getRevisitQueue, isSameLocation } from '../utils/helpers';
import type { SmellMemory } from '../utils/constants';
import type { MemoryInput } from '../store/memoryStore';
import { BookOpenCheck } from 'lucide-react';

const defaultFilters: Filters = {
  smellType: '',
  season: '',
  emotion: '',
  inQueue: false,
};

export default function Home() {
  const {
    memories,
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

  // 复访队列：强度降序，强度相同封存时间早者优先（排序逻辑在 helpers 中统一维护）
  const queue = useMemo(() => getRevisitQueue(memories), [memories]);

  const hasFilter = !!(filters.smellType || filters.season || filters.emotion || filters.inQueue);

  const handleFilterChange = (key: keyof Filters, value: string | boolean) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };
  const resetFilters = () => setFilters(defaultFilters);

  const openAddModal = () => { setEditing(null); setModalOpen(true); };
  const openEditModal = (m: SmellMemory) => { setEditing(m); setModalOpen(true); };

  const handleSubmit = (data: MemoryInput) => {
    if (editing) {
      const original = memories.find((m) => m.id === editing.id);
      let replaceReason: string | undefined;
      // 编辑在队记录的地点且与另一条在队记录撞地点：先索取替换原因
      if (original?.in_queue && !isSameLocation(original.location, data.location)) {
        const occupant = memories.find(
          (m) => m.id !== editing.id && m.in_queue && isSameLocation(m.location, data.location),
        );
        if (occupant) {
          const input = window.prompt(
            `「${data.location.trim()}」已有同地点的复访记录（${occupant.source_guess || '未记录来源'}）。\n` +
            '请填写替换原因（留空或取消则保存编辑，但本条移出复访队列）：',
          );
          replaceReason = input?.trim() ? input : undefined;
        }
      }
      updateMemory(editing.id, data, replaceReason);
    } else {
      addMemory(data);
    }
  };

  const handleDelete = (id: string) => {
    const target = memories.find((m) => m.id === id);
    const msg = `确认删除「${target?.location ?? '这段记忆'}」吗？${target?.in_queue ? '它同时会从复访队列移除。' : ''}`;
    if (window.confirm(msg)) {
      deleteMemory(id);
      if (expandedId === id) setExpandedId(null);
    }
  };

  const handleToggleQueue = (m: SmellMemory) => {
    if (m.in_queue) {
      dequeue(m.id);
      return;
    }
    const result = enqueue(m.id);
    if (result.ok) return;
    // 同地点已有在队记录：必须填写替换原因，否则拒绝且队列不变
    const reason = window.prompt(
      `「${m.location.trim()}」已有同地点的复访记录。\n` +
      '新记录将替换它进入队列（旧记录仍保留在档案中），请填写替换原因：',
    );
    if (reason === null || !reason.trim()) {
      window.alert('替换原因为空，已取消，队列未变化');
      return;
    }
    const retry = enqueue(m.id, reason);
    if (!retry.ok) window.alert('替换原因缺失，已取消，队列未变化');
  };

  const scrollToCard = (id: string) => {
    // 目标可能被当前筛选条件隐藏：先清除筛选，再定位
    if (!memories.some((m) => m.id === id)) return;
    if (!filteredMemories.some((m) => m.id === id)) setFilters(defaultFilters);
    setExpandedId(id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-memory-id="${id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  };

  return (
    <div className="min-h-screen">
      <Header onAdd={openAddModal} memoryCount={memories.length} queueCount={queue.length} />

      <main className="container max-w-6xl pb-20">
        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onReset={resetFilters}
          resultCount={filteredMemories.length}
        />

        <RevisitQueue
          queue={queue}
          onLocate={scrollToCard}
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
                {hasFilter
                  ? '没有匹配的气味记忆'
                  : '还没有封存任何气味'}
              </h3>
              <p className="text-ink-700/60 max-w-md mx-auto mb-6">
                {hasFilter
                  ? filters.inQueue
                    ? '复访队列为空——展开气味卡片，点击「加入复访」安排下一次重逢'
                    : '换一组筛选条件试试？或者先封存一段新的气味'
                  : '空气中一定有让你难忘的味道——无论是衣柜里的樟木香，还是雨后操场的青草气'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={openAddModal} className="btn-primary">
                  封存第一段气味
                </button>
                {hasFilter && (
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
