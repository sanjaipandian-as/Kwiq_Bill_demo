import React, { useReducer, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Calendar, Calculator } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import CalculatorModal from '../CalculatorModal';
import CustomerSection from './CustomerSection';
import BillSummary    from './BillSummary';
import PaymentSection from './PaymentSection';
import ActionsBar     from './ActionsBar';
import {
  billingReducer,
  initialState,
  A,
  buildSavePayload,
  rupeesToPaise,
} from './billingReducer';

/**
 * BillingSidebar — orchestration shell
 */
const BillingSidebar = forwardRef(({
  totals        = {},
  cart          = [],
  settings      = {},
  taxType       = 'Intra-State',
  onTaxTypeChange,
  onEditDiscount,
  onRemoveDiscount,
  isProcessing  = false,
  requireMobile = true,
  onSaveReady,          // (payload) => void
}, ref) => {
  const [state, dispatch] = useReducer(billingReducer, initialState);

  // totalPaise is injected from the parent's calculated totals
  const totalPaise = rupeesToPaise(totals?.total ?? 0);

  // ── Refs for keyboard focus chain ──────────────────────────────────────────
  const mobileRef      = useRef(null);
  const nameRef        = useRef(null);
  const paymentListRef  = useRef(null); // PaymentEntryList imperative handle
  const saveRef        = useRef(null);
  const [isCalculatorOpen, setIsCalculatorOpen] = React.useState(false);

  // ── Expose methods to parent ───────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    reset: () => {
      dispatch({ type: A.RESET_PAYMENTS, totalPaise });
    },
    focusMobile: () => mobileRef.current?.focus(),
  }));

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  // ── Ensure there is always at least one payment entry ────────────────────
  useEffect(() => {
    if (state.payments.length === 0) {
      dispatch({ type: A.ADD_PAYMENT, payload: { amount: totalPaise, method: null }, totalPaise });
    }
  }, []);

  // ── Sync "Paid" amount when totals change ──────────────────────────────────
  useEffect(() => {
    dispatch({ type: A.SYNC_TOTAL, payload: totalPaise });
  }, [totalPaise]);

  // ── Validation guard for Save button ──────────────────────────────────────
  const isCustomerValid = useCallback(() => {
    const { customer } = state;
    if (!requireMobile) return true;
    return (
      customer.mobile.length === 10 &&
      customer.name.trim().length > 0
    );
  }, [state.customer, requireMobile]);

  const isSaveDisabled = !isCustomerValid();

  // ── Save Trigger handler (advances to Preview) ─────────────────────────────
  const handleTriggerPreview = useCallback((printFormat) => {
    if (isSaveDisabled || isProcessing) return;

    const hasErrors = Object.keys(state.errors).length > 0;
    if (hasErrors) return;

    const customerForPayload = {
      id:       state.customer.id,
      phone:    state.customer.mobile,
      fullName: state.customer.name,
      name:     state.customer.name,
    };

    if (onSaveReady) {
      onSaveReady({
        sidebarState:   state,
        customer:       customerForPayload,
        printFormat,
        cart:           cart,
      });
    }
  }, [state, isSaveDisabled, isProcessing, onSaveReady, cart]);

  const sidebarRef = useRef(null);

  // ── Keyboard: name-enter → focus first payment method ─────────────────────
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.type === 'sidebar:name-enter') {
        paymentListRef.current?.focusEntry(0);
      }
    };
    el.addEventListener('sidebar:name-enter', handler);
    return () => el.removeEventListener('sidebar:name-enter', handler);
  }, []);


  return (
    <div
      id="billing-sidebar"
      ref={sidebarRef}
      className="flex flex-col h-full bg-zinc-50 shadow-none overflow-hidden w-full"
    >
      <div className="shrink-0 px-4 py-3 border-b border-zinc-200 bg-white flex justify-between items-center h-14">
        <div className="flex items-center gap-2 text-slate-500">
          <Calendar size={14} />
          <span className="text-xs font-semibold">{currentDate}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg"
          onClick={() => setIsCalculatorOpen(true)}
        >
          <Calculator size={16} />
        </Button>
      </div>

      <CalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
      />

      <div className="flex-1 flex flex-col p-2 space-y-2 overflow-auto min-h-0">
        <CustomerSection
          customer={state.customer}
          dispatch={dispatch}
          requireMobile={requireMobile}
          onMobileRef={(el) => { mobileRef.current = el; }}
          onNameRef={(el) => { nameRef.current = el; }}
        />

        <BillSummary
          totals={totals}
          taxType={taxType}
          onTaxTypeChange={onTaxTypeChange}
          onEditDiscount={onEditDiscount}
          onRemoveDiscount={onRemoveDiscount}
        />

        <PaymentSection
          ref={paymentListRef}
          payments={state.payments}
          errors={state.errors}
          paymentStatus={state.paymentStatus}
          totalPaidPaise={state.totalPaidPaise}
          balancePaise={state.balancePaise}
          changePaise={state.changePaise}
          dispatch={dispatch}
          totalPaise={totalPaise}
          onEnterLastAmount={() => {
            paymentListRef.current?.focusAddButton();
          }}
          onArrowUpFirst={() => {
            nameRef.current?.focus();
          }}
          onArrowDownLast={() => {
            // Forward from Split Button to focus the first status button with 0 tabindex
            document.querySelector('[data-status-id="Paid"]')?.focus();
          }}
          onArrowDownStatus={() => {
            saveRef.current?.focus();
          }}
          onArrowUpStatus={() => {
            paymentListRef.current?.focusAddButton();
          }}
          onFocusAddButton={() => {
            paymentListRef.current?.focusAddButton();
          }}
        />
      </div>

      <ActionsBar
        isSaveDisabled={isSaveDisabled}
        isProcessing={isProcessing}
        saveRef={saveRef}
        onPreview={handleTriggerPreview}
        onArrowUp={() => {
          document.querySelector('[data-status-id="Paid"]')?.focus();
        }}
      />
    </div>
  );
});

export default React.memo(BillingSidebar);
