import React, { useRef } from 'react';
import { Banknote, Smartphone, CreditCard, Landmark, ScrollText } from 'lucide-react';
import { cn } from '../../../../lib/utils';

export const PAYMENT_METHODS = [
  { id: 'Cash',          label: 'Cash',   Icon: Banknote   },
  { id: 'UPI',           label: 'UPI',    Icon: Smartphone },
  { id: 'Card',          label: 'Card',   Icon: CreditCard },
  { id: 'Bank Transfer', label: 'Bank',   Icon: Landmark   },
  { id: 'Cheque',        label: 'Cheque', Icon: ScrollText },
];

/**
 * MethodSelector — roving tabindex pattern.
 *
 * Only the currently selected button has tabIndex=0.
 * Arrow keys move focus (and selection) within the group.
 * This avoids a custom focus-engine entirely.
 */
export default function MethodSelector({ selected, onChange, onArrowDown, onArrowUp, entryId }) {
  const btnRefs = useRef({});

  const handleKeyDown = (e, methodId) => {
    const idx     = PAYMENT_METHODS.findIndex(m => m.id === methodId);
    const total   = PAYMENT_METHODS.length;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = PAYMENT_METHODS[(idx + 1) % total];
      btnRefs.current[next.id]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = PAYMENT_METHODS[(idx - 1 + total) % total];
      btnRefs.current[prev.id]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Enter = Forward ONLY (No toggle/select)
      onArrowDown?.();
    } else if (e.key === ' ') {
      e.preventDefault();
      // Space = Toggle (Strictly NO forward movement)
      const nextValue = selected === methodId ? null : methodId;
      onChange(nextValue);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onArrowDown?.();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onArrowUp?.();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Payment method"
      className="flex gap-1"
    >
      {PAYMENT_METHODS.map(({ id, label, Icon }, index) => {
        const isSelected = selected === id;
        return (
          <button
            key={id}
            ref={el => (btnRefs.current[id] = el)}
            role="radio"
            aria-checked={isSelected}
            data-method-id={id}
            data-entry-id={entryId}
            // roving tabindex: first button gets 0 if none selected
            tabIndex={isSelected || (!selected && index === 0) ? 0 : -1}
            onClick={(e) => {
              if (e.detail === 0) return; // Prevent Enter/Space native clicks from conflicting with onKeyDown
              const nextValue = selected === id ? null : id;
              onChange(nextValue);
              if (nextValue) onArrowDown?.();
            }}
            onKeyDown={e => handleKeyDown(e, id)}
            title={label}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2 rounded-lg border-2 transition-all h-12 focus:outline-none transition-all',
              isSelected
                ? 'bg-black text-white border-black focus:ring-2 focus:ring-black focus:ring-offset-2 scale-[1.05] z-10 font-bold'
                : 'border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 focus:border-black focus:border-[3px] focus:text-black focus:bg-white',
            )}
          >
            <Icon size={18} className="mb-0.5" />
            <span className="text-[8px] font-extrabold uppercase tracking-tight">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
