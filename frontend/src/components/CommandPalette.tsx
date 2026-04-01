import React, { useState, useRef, useEffect, type ReactNode } from 'react';

export interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  hint?: string;
  keywords?: string[];
}

interface Props {
  items: CommandItem[];
  onClose: () => void;
  onExecute: (id: string) => void;
}

export default function CommandPalette({ items, onClose, onExecute }: Props) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (!normalizedQuery) return true;
    const haystack = [item.label, item.description, ...(item.keywords || [])].join(' ').toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  useEffect(() => {
    if (activeIdx >= filtered.length) {
      setActiveIdx(Math.max(0, filtered.length - 1));
    }
  }, [activeIdx, filtered.length]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((v) => Math.min(v + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((v) => Math.max(v - 1, 0)); }
    if (e.key === 'Enter' && filtered[activeIdx]) { onExecute(filtered[activeIdx].id); }
  };

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        <div className="command-palette-header">
          <div>
            <strong>控制台指令</strong>
            <span>页面跳转、面板开关和系统操作</span>
          </div>
          <span className="command-palette-kbd">ESC</span>
        </div>
        <input
          ref={inputRef}
          placeholder="输入页面、动作或关键词..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
        />
        <div className="command-palette-list">
          {filtered.map((item, i) => (
            <div
              key={item.id}
              className={`command-palette-item ${i === activeIdx ? 'active' : ''}`}
              onClick={() => onExecute(item.id)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="command-palette-item__icon">{item.icon}</span>
              <span className="command-palette-item__content">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
              {item.hint && <span className="command-palette-item__hint">{item.hint}</span>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="command-palette-empty">没有找到匹配的指令</div>
          )}
        </div>
      </div>
    </div>
  );
}
