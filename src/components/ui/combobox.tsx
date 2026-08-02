'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Extra text also matched when searching (e.g. a code) but not required to display separately. */
  keywords?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  required,
  id,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.keywords ?? '').toLowerCase().includes(q),
    );
  }, [options, query]);

  function selectOption(opt: ComboboxOption) {
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlighted]) selectOption(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={id ? `${id}-listbox` : undefined}
          aria-required={required}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-[var(--shadow-sm)]',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : selected?.label ?? ''}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(0);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onKeyDown={handleKeyDown}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {/* Hidden input so native form validation (required) still works for this custom control. */}
        <input
          tabIndex={-1}
          aria-hidden
          required={required}
          value={value}
          onChange={() => {}}
          className="absolute inset-0 -z-10 h-full w-full opacity-0"
        />
      </div>
      {open && (
        <div
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-input bg-card py-1 shadow-[var(--shadow-md)]"
        >
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matches</p>
          )}
          {filtered.map((opt, i) => (
            <button
              type="button"
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm',
                i === highlighted ? 'bg-[var(--accent-muted)]' : 'hover:bg-muted/50',
              )}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => selectOption(opt)}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-yellow)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
