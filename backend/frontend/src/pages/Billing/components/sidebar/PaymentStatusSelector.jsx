import React from 'react';
import { CheckCircle, CreditCard, AlertCircle, Ban } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { paiseToRupees, A } from './billingReducer';

/**
 * PaymentStatusSelector — manual status selection + derived balance display.
 * Restored per user request: Paid, Partial, and Credit buttons.
 */
export default function PaymentStatusSelector({
  paymentStatus,   // 'Unpaid' | 'Partially Paid' | 'Paid'
  totalPaidPaise,
  balancePaise,
  changePaise,
  dispatch,
  totalPaise,
  onArrowUp,
  onArrowDown,
}) {
  const statuses = [
    { id: 'Paid',           label: 'Paid',    icon: CheckCircle, color: 'emerald' },
    { id: 'Partially Paid', label: 'Partial', icon: AlertCircle, color: 'amber'   },
    { id: 'Unpaid',         label: 'Credit',  icon: Ban,         color: 'zinc'    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="Payment status"
        className="grid grid-cols-3 gap-2"
        onKeyDown={(e) => {
          // Find which button currently has focus via data attribute
          const focusedId = document.activeElement?.getAttribute('data-status-id');
          const currentIndex = statuses.findIndex(s => s.id === (focusedId || paymentStatus));
          // Fallback to first if nothing focused/selected
          const idx = currentIndex === -1 ? 0 : currentIndex;

          if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = (idx + 1) % statuses.length;
            document.querySelector(`[data-status-id="${statuses[next].id}"]`)?.focus();
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = (idx - 1 + statuses.length) % statuses.length;
            document.querySelector(`[data-status-id="${statuses[prev].id}"]`)?.focus();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            onArrowUp?.();
          } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            onArrowDown?.();
          } else if (e.key === ' ') {
            e.preventDefault();
            // Space: Toggle selection (no forward movement)
            const clickedId = focusedId || statuses[idx].id;
            const nextStatus = paymentStatus === clickedId ? null : clickedId;
            dispatch({ type: A.SET_PAYMENT_STATUS, payload: nextStatus, totalPaise });
          }
        }}
      >
        {statuses.map(({ id, label, icon: Icon, color }, index) => {
          const isSelected = paymentStatus === id;
          
          const handleToggle = (e) => {
            // Ignore if triggered by keyboard (e.g. Enter/Space) so onKeyDown can handle it exclusively
            if (e.detail === 0) return;
            const nextStatus = isSelected ? null : id;
            dispatch({ type: A.SET_PAYMENT_STATUS, payload: nextStatus, totalPaise });
          };

          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-status-id={id}
              // Roving tabindex: first button gets 0 if none selected
              tabIndex={isSelected || (!paymentStatus && index === 0) ? 0 : -1}
              onClick={handleToggle}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 rounded-xl border-2 transition-all gap-1 focus:outline-none transition-all',
                isSelected
                  ? 'bg-black text-white border-black focus:ring-2 focus:ring-black focus:ring-offset-2 scale-[1.05] z-10 font-bold'
                  : 'bg-white border-zinc-200 text-zinc-400 hover:bg-zinc-50 focus:border-black focus:border-[4px] focus:text-black focus:bg-white'
              )}
            >
              <Icon size={16} />
              <span className="text-[10px] font-extrabold uppercase tracking-tight">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Derived Amounts Display */}
      <div className="space-y-1.5 px-1">
        {/* Paid so far */}
        {totalPaidPaise > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Total Paid</span>
            <span className="text-sm font-bold text-slate-900">₹{paiseToRupees(totalPaidPaise)}</span>
          </div>
        )}

        {/* Balance Due (Show for Partial, Credit, or when Balance > 0) */}
        {(balancePaise > 0 || paymentStatus === 'Partially Paid' || paymentStatus === 'Unpaid') && (
          <div className="flex justify-between items-center bg-zinc-900 px-3 py-2 rounded-lg text-white shadow-lg">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Balance Due</span>
            <span className="text-lg font-bold">₹{paiseToRupees(balancePaise)}</span>
          </div>
        )}

        {/* Change to Return (Only show for Paid status) */}
        {paymentStatus === 'Paid' && changePaise > 0 && (
          <div className="flex justify-between items-center bg-emerald-600 px-3 py-2 rounded-lg text-white shadow-lg">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Change Return</span>
            <span className="text-lg font-bold">₹{paiseToRupees(changePaise)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
