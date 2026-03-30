import React from 'react';
import { Edit2, X } from 'lucide-react';
import { cn } from '../../../../lib/utils';

/**
 * BillSummary — read-only display of computed bill totals.
 * Receives totals from parent (calculated via calculateTotals).
 * This component never derives any values itself.
 */
export default function BillSummary({
  totals = {},
  taxType = 'Intra-State',
  onTaxTypeChange,
  onEditDiscount,
  onRemoveDiscount,
}) {
  const grossTotal    = totals.grossTotal        ?? 0;
  const itemDiscount  = totals.itemDiscount       ?? 0;
  const billDiscount  = totals.discount           ?? 0;
  const tax           = totals.tax                ?? 0;
  const roundOff      = totals.roundOff           ?? 0;
  const total         = totals.total              ?? 0;
  const isInterState  = taxType === 'Inter-State';

  return (
    <div className="flex flex-col gap-1.5 shrink-0 bg-white rounded-xl border border-zinc-200 p-4 shadow-sm">
      {/* Subtotal */}
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">Subtotal</span>
        <span className="font-semibold text-slate-900">₹{grossTotal.toFixed(2)}</span>
      </div>

      {/* Item Discount */}
      {itemDiscount > 0 && (
        <div className="flex justify-between text-sm text-black">
          <span>Item Discount</span>
          <span>- ₹{itemDiscount.toFixed(2)}</span>
        </div>
      )}

      {/* Bill Discount */}
      <div className="flex justify-between items-center text-sm h-6">
        <span className="text-black font-medium text-xs uppercase tracking-tight">Bill Discount</span>
        <div className="flex items-center gap-2">
          {billDiscount > 0 ? (
            <>
              <span className="font-medium text-black">- ₹{billDiscount.toFixed(2)}</span>
              <div className="flex bg-slate-100 rounded-md p-0.5 border border-slate-200 scale-90 origin-right">
                <button onClick={onEditDiscount} className="p-1 hover:bg-white rounded-sm" title="Edit discount">
                  <Edit2 size={10} />
                </button>
                <div className="w-px bg-slate-200 my-0.5" />
                <button onClick={onRemoveDiscount} className="p-1 hover:bg-white rounded-sm" title="Remove discount">
                  <X size={10} />
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onEditDiscount}
              className="text-[10px] font-bold text-black hover:text-neutral-700 hover:underline flex items-center gap-1"
            >
              + ADD DISC
            </button>
          )}
        </div>
      </div>

      {/* Tax Type Selector */}
      <div className="flex justify-between items-center py-1 mt-1 border-t border-dashed border-slate-100">
        <div className="flex bg-slate-100 rounded p-0.5">
          {['Intra-State', 'Inter-State'].map(type => (
            <button
              key={type}
              onClick={() => onTaxTypeChange?.(type)}
              className={cn(
                'px-2 py-0.5 text-[10px] font-bold rounded transition-colors',
                taxType === type ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600',
              )}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 font-semibold">
          Tax: ₹{tax.toFixed(2)}
        </div>
      </div>

      {/* Tax Breakdown */}
      {tax > 0 && (
        <div className="flex flex-col gap-0.5 px-1 bg-slate-50/50 rounded p-1 mb-1">
          {isInterState ? (
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>IGST</span>
              <span>₹{tax.toFixed(2)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>SGST</span>
                <span>₹{(tax / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>CGST</span>
                <span>₹{(tax / 2).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Round Off */}
      <div className="flex justify-between text-[10px] text-zinc-400 px-1">
        <span>Round Off</span>
        <span>{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
      </div>

      {/* Grand Total */}
      <div className="border-t border-slate-100 pt-1 mt-1 flex justify-between items-end">
        <span className="font-bold text-slate-700 text-sm">Grand Total</span>
        <span className="text-3xl font-bold tracking-tight text-zinc-900 leading-none">
          ₹{total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
