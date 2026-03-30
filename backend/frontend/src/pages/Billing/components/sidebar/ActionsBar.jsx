import React, { useState, useEffect, useRef } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../lib/utils';

const PRINT_FORMATS = [
  { group: 'Receipt', options: ['80mm', '58mm'] },
  { group: 'Sheet',   options: ['A4', 'A5']     },
];

/**
 * ActionsBar
 *
 * Fixed bottom bar: print-format picker + Save & Print button.
 * Alt+B shortcut is scoped to a keydown listener on this component's container
 * (not a global window listener) using the onKeyDown prop pattern.
 *
 * The button is disabled when:
 *   - customer is invalid (mobile incomplete or name empty)
 *   - isProcessing
 *
 * `onSave` is called with the selected printFormat.
 */
export default function ActionsBar({ isSaveDisabled, isProcessing, saveRef, onPreview, onArrowUp }) {
  const [printFormat, setPrintFormat] = useState('80mm');
  const [isHighlighted, setIsHighlighted] = useState(false);

  // Alt+B shortcut — scoped event listener attached to the document but
  // only fires when not in a text input (prevents collisions with typing)
  useEffect(() => {
    const handler = (e) => {
      if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        if (isSaveDisabled || isProcessing) return;
        e.preventDefault();
        triggerPreview();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSaveDisabled, isProcessing, printFormat]);

  const triggerPreview = () => {
    if (isSaveDisabled || isProcessing) return;
    setIsHighlighted(true);
    setTimeout(() => setIsHighlighted(false), 350);
    onPreview(printFormat);
  };

  return (
    <div className="shrink-0 p-2 border-t border-slate-200 bg-white space-y-2 z-10">
      <div className="flex gap-2 h-12">
        {/* Print format dropdown */}
        <div className="relative w-24 shrink-0">
          <select
            value={printFormat}
            onChange={e => setPrintFormat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                onArrowUp?.();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                saveRef.current?.focus();
              }
            }}
            className="w-full h-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium focus:outline-none focus:border-black focus:border-[2px] transition-all appearance-none"
          >
            {PRINT_FORMATS.map(({ group, options }) => (
              <optgroup key={group} label={group}>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </optgroup>
            ))}
          </select>
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <Printer size={12} />
          </div>
        </div>

        {/* Save & Print */}
        <Button
          ref={saveRef}
          className={cn(
            'flex-1 h-12 bg-zinc-900 text-white hover:bg-black shadow-lg hover:shadow-xl transition-all font-bold text-base flex items-center justify-center gap-2 rounded-xl',
            'focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:scale-[1.01]',
            isHighlighted && '!bg-green-600 hover:!bg-green-600 scale-[1.03] shadow-green-500/40 shadow-xl ring-2 ring-green-400 ring-offset-1',
            (isSaveDisabled || isProcessing) && 'opacity-50 cursor-not-allowed bg-zinc-400 shadow-none',
          )}
          onClick={triggerPreview}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              // Focus the print format dropdown
              e.currentTarget.parentElement?.querySelector('select')?.focus();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              // Wrap back to top of sidebar
              document.getElementById('customer-mobile-input')?.focus();
            }
          }}
          disabled={isProcessing || isSaveDisabled}
          title={isSaveDisabled ? 'Please enter valid customer mobile and name' : 'Save & Print (Alt+B)'}
        >
          {isProcessing ? (
            <><Printer size={16} className="animate-pulse" /> Saving...</>
          ) : (
            <><Printer size={16} /> Save &amp; Print</>
          )}
        </Button>
      </div>
    </div>
  );
}
