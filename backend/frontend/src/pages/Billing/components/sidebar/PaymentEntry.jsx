import React, { useRef } from 'react';
import { X } from 'lucide-react';
import MethodSelector from './MethodSelector';
import AmountInput from './AmountInput';
import { A } from './billingReducer';

/**
 * PaymentEntry — one row in the multi-payment list.
 * method-selector + amount-input + remove button.
 *
 * Focus flow: MethodSelector → [Enter/ArrowDown] → AmountInput → [Enter] → next entry or Save
 */
export default function PaymentEntry({
  entry,           // { id, method, amount }
  dispatch,
  totalPaise,
  error,           // field-level error from state.errors[entry.id]
  onEnterAmount,   // () => void — called when Enter pressed on amount (move to next)
  amountInputRef,  // forwarded ref for external focus control
  isOnly,          // bool — true when this is the only entry (show different placeholder)
  canRemove,       // bool — false when only one entry remains
  onRemove,
}) {
  const methodFocusMoverRef = useRef(null); // stores a fn to focus the selected method btn

  return (
    <div className="flex flex-col gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
      {/* Method Selector */}
      <MethodSelector
        selected={entry.method}
        entryId={entry.id}
        onChange={(method) =>
          dispatch({
            type: A.UPDATE_PAYMENT_METHOD,
            payload: { id: entry.id, method },
            totalPaise,
          })
        }
        onArrowDown={() => amountInputRef?.current?.focus()}
        onArrowUp={() => {
          // Bubble up to PaymentEntryList to handle "prev entry" or "Name input"
          entry.onArrowUp?.();
        }}
      />

      {/* Amount + Remove row */}
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <AmountInput
            amountPaise={entry.amount}
            error={error}
            inputRef={amountInputRef}
            placeholder={isOnly ? 'Enter amount received' : 'Amount for this method'}
            onCommit={(paise) =>
              dispatch({
                type: A.UPDATE_PAYMENT_AMOUNT,
                payload: { id: entry.id, amount: paise },
                totalPaise,
              })
            }
            onEnter={onEnterAmount}
            onArrowUp={() => {
          // Focus the currently selected method button (the one with tabindex=0)
          const btn = 
            document.querySelector(`[data-entry-id="${entry.id}"][tabindex="0"]`) ||
            document.querySelector(`[data-entry-id="${entry.id}"]`);
          btn?.focus();
        }}
          />
        </div>
        {canRemove && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onRemove(entry.id)}
            title="Remove payment entry"
            className="mt-1.5 h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
