import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { Plus } from 'lucide-react';
import PaymentEntry from './PaymentEntry';
import { A } from './billingReducer';

/**
 * PaymentEntryList
 *
 * Renders all payment entries and an "Add Payment" button.
 * Manages an array of AmountInput refs so parent (BillingSidebar) can
 * focus the last entry's amount input after adding.
 *
 * Exposed via ref: { focusEntry(index), focusAddButton() }
 */
const PaymentEntryList = forwardRef(function PaymentEntryList(
  { payments, errors, dispatch, totalPaise, onEnterLastAmount, onArrowUpFirst, onArrowDownLast, onFocusAddButton },
  ref
) {
  const amountRefs  = useRef([]); // amountRefs.current[i] = ref to AmountInput for entry i
  const addBtnRef   = useRef(null);

  useImperativeHandle(ref, () => ({
    focusEntry(index) {
      // Focus the method selector of entry[index] — the selected button has tabIndex=0
      const entryId = payments[index]?.id;
      if (!entryId) return;
      
      // Look for the selected button first, then fallback to first button
      const btn = 
        document.querySelector(`[data-entry-id="${entryId}"][aria-checked="true"]`) ||
        document.querySelector(`[data-entry-id="${entryId}"]`);
      btn?.focus();
    },
    focusAmountInput(index) {
      amountRefs.current[index]?.current?.focus();
    },
    focusAddButton() {
      addBtnRef.current?.focus();
    },
  }));

  const handleAddPayment = () => {
    dispatch({ type: A.ADD_PAYMENT, totalPaise });
    // After render, focus the new entry's first method button
    setTimeout(() => {
      const newIdx = payments.length; 
      // Focus first button of the new entry
      const radioGroups = document.querySelectorAll('[role="radiogroup"]');
      const targetGroup = radioGroups[newIdx];
      const btn = targetGroup?.querySelector('button');
      btn?.focus();
    }, 50);
  };

  const handleRemovePayment = (id) => {
    const idx = payments.findIndex(p => p.id === id);
    if (idx === -1) return;

    // Deterministic focus recovery:
    // 1. Next entry's method selector
    // 2. Previous entry's amount input
    // 3. Fallback to "Add Payment" or "Save"
    const nextId = payments[idx + 1]?.id;
    const prevIdx = idx - 1;

    dispatch({ type: A.REMOVE_PAYMENT, payload: id, totalPaise });

    setTimeout(() => {
      if (nextId) {
        // Option 1: Next entry's method
        const btn = document.querySelector(`[data-entry-id="${nextId}"][tabindex="0"]`) ||
                   document.querySelector(`[data-entry-id="${nextId}"]`);
        btn?.focus();
      } else if (prevIdx >= 0) {
        // Option 2: Previous entry's amount
        amountRefs.current[prevIdx]?.current?.focus();
      } else {
        // Option 3: Fallback
        addBtnRef.current?.focus() || onFocusAddButton?.();
      }
    }, 50);
  };

  return (
    <div className="flex flex-col gap-2">
      {payments.map((entry, idx) => {
        if (!amountRefs.current[idx]) {
          amountRefs.current[idx] = { current: null };
        }
        const isLast = idx === payments.length - 1;
        const canRemove = payments.length > 1;

        return (
          <PaymentEntry
            key={entry.id}
            entry={{
              ...entry,
              onArrowUp: () => {
                if (idx > 0) {
                  // Focus previous entry's amount input
                  amountRefs.current[idx - 1]?.current?.focus();
                } else {
                  // First entry arrow up -> focus name input
                  onArrowUpFirst?.();
                }
              }
            }}
            dispatch={dispatch}
            totalPaise={totalPaise}
            error={errors[entry.id]}
            amountInputRef={amountRefs.current[idx]}
            isOnly={payments.length === 1}
            canRemove={canRemove}
            onRemove={handleRemovePayment}
            onEnterAmount={() => {
              if (isLast) {
                // Last entry's amount → move to Add Button (so user can choose next status)
                addBtnRef.current?.focus();
              } else {
                // Focus next entry's method selector
                const nextId = payments[idx + 1]?.id;
                if (nextId) {
                  const btn =
                    document.querySelector(`[data-entry-id="${nextId}"][aria-checked="true"]`) ||
                    document.querySelector(`[data-entry-id="${nextId}"]`);
                  btn?.focus();
                }
              }
            }}
          />
        );
      })}

      {/* Split Payment button */}
      <button
        ref={addBtnRef}
        type="button"
        onClick={handleAddPayment}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            onArrowDownLast?.();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            // Focus last entry's amount input
            amountRefs.current[payments.length - 1]?.current?.focus();
          }
        }}
        className="flex items-center justify-center gap-1.5 w-full py-2 text-[10px] font-bold text-zinc-500 border border-dashed border-zinc-300 rounded-lg hover:border-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all focus:outline-none focus:border-black focus:border-[3px] focus:ring-0 uppercase tracking-wider"
        title="Split across multiple payment methods"
      >
        <Plus size={13} /> Split Payment
      </button>
    </div>
  );
});

export default PaymentEntryList;
