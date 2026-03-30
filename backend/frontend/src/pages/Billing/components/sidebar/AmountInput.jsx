import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../../../lib/utils';
import { rupeesToPaise, paiseToRupees } from './billingReducer';

/**
 * AmountInput
 *
 * Input sync strategy:
 *   - Local `displayValue` (string) drives the input — never overwritten while focused.
 *   - On blur / Enter: parse → convert to paise → dispatch to reducer.
 *   - If invalid (empty, negative, NaN): show inline error, do NOT dispatch.
 *   - Parent reducer updates don't force the display value to reset mid-typing.
 */
export default function AmountInput({
  amountPaise,    // current committed value from reducer
  onCommit,       // (paise: number) => void
  onEnter,        // () => void — move focus to next step
  onArrowUp,      // () => void — move focus back to method
  error,          // string | undefined — reducer-level error
  inputRef,       // forwarded ref
  placeholder,
}) {
  // Local display value — string, user is typing
  const [display, setDisplay] = useState('');
  const [localError, setLocalError] = useState('');
  const isFocusedRef = useRef(false);

  // Sync display from reducer only when NOT focused (i.e., externally driven reset)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setDisplay(amountPaise > 0 ? paiseToRupees(amountPaise) : '');
    }
  }, [amountPaise]);

  const validate = (strVal) => {
    if (strVal === '' || strVal === undefined) return null; // empty is allowed (results in 0 paise)
    const n = parseFloat(strVal);
    if (isNaN(n)) return 'Invalid amount';
    if (n < 0)    return 'Amount cannot be negative';
    return null;
  };

  const commit = (strVal) => {
    const errMsg = validate(strVal);
    if (errMsg) {
      setLocalError(errMsg);
      return false;
    }
    setLocalError('');
    const paise = strVal === '' ? 0 : rupeesToPaise(strVal);
    onCommit(paise);
    return true;
  };

  const handleChange = (e) => {
    const val = e.target.value;
    // Allow digits and at most one decimal point
    if (/^(\d*\.?\d{0,2})?$/.test(val)) {
      setDisplay(val);
      if (localError) setLocalError(''); // clear error as user types
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    commit(display);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    // Show committed value on focus for easy editing
    if (amountPaise > 0 && display === '') {
      setDisplay(paiseToRupees(amountPaise));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const ok = commit(display);
      if (ok) onEnter?.();
      // If validation failed, keep focus here (do NOT move forward)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onArrowUp?.();
    }
  };

  const activeError = localError || error;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base select-none">₹</div>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? '0.00'}
          className={cn(
            'w-full pl-7 pr-3 h-10 text-xl font-bold rounded-lg border bg-white shadow-inner transition-all',
            'focus:outline-none focus:ring-0',
            activeError
              ? 'border-red-400 focus:border-red-600 focus:border-[3px]'
              : 'border-zinc-200 focus:border-black focus:border-[4px]',
          )}
        />
      </div>
      {activeError && (
        <p className="text-xs text-red-500 px-1">{activeError}</p>
      )}
    </div>
  );
}
