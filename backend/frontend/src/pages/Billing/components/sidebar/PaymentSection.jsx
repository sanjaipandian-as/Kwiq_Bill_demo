import React, { forwardRef } from 'react';
import PaymentEntryList from './PaymentEntryList';
import PaymentStatusSelector from './PaymentStatusSelector';

/**
 * PaymentSection — container for the entire payment area.
 * Receives state slice from BillingSidebar's useReducer.
 * Passes list-ref upward so BillingSidebar can focus entries from keyboard handler.
 */
const PaymentSection = forwardRef(function PaymentSection(
  { 
    payments, errors, paymentStatus, totalPaidPaise, balancePaise, changePaise, 
    dispatch, totalPaise, onEnterLastAmount,
    onArrowUpFirst, onArrowDownLast, onArrowDownStatus, onArrowUpStatus
  },
  listRef
) {
  return (
    <div className="flex flex-col gap-3 bg-white rounded-xl border border-zinc-200 p-3 shadow-sm">
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Payment</label>

      <PaymentEntryList
        ref={listRef}
        payments={payments}
        errors={errors}
        dispatch={dispatch}
        totalPaise={totalPaise}
        onEnterLastAmount={onEnterLastAmount}
        onArrowUpFirst={onArrowUpFirst}
        onArrowDownLast={onArrowDownLast}
      />

      <PaymentStatusSelector
        paymentStatus={paymentStatus}
        totalPaidPaise={totalPaidPaise}
        balancePaise={balancePaise}
        changePaise={changePaise}
        dispatch={dispatch}
        totalPaise={totalPaise}
        onArrowDown={onArrowDownStatus}
        onArrowUp={onArrowUpStatus}
      />
    </div>
  );
});

export default PaymentSection;
