/**
 * Billing Sidebar Reducer
 *
 * Single source of truth for all sidebar state:
 *   - customer (mobile, name, status, suggestions)
 *   - payments  ([{ id, method, amount }])           ← amount in paise (integer)
 *
 * Derived values computed here (never in components):
 *   - totalPaidPaise
 *   - balancePaise
 *   - changePaise
 *   - paymentStatus  ('Unpaid' | 'Partially Paid' | 'Paid')
 *
 * IMPORTANT: totalPaise (the bill total) is NOT part of this state.
 * It comes from the parent (calculateTotals) and is passed into actions
 * that need it for validation.  Amounts are NEVER clamped — validation
 * errors are surfaced via the `errors` map so the UI can display them
 * inline without destroying the user's input.
 */

// ─── Action Types ────────────────────────────────────────────────────────────

export const A = {
  // Customer
  SET_MOBILE:        'SET_MOBILE',
  SET_CUSTOMER_NAME: 'SET_CUSTOMER_NAME',
  SELECT_CUSTOMER:   'SELECT_CUSTOMER',   // found in DB
  MARK_NEW_CUSTOMER: 'MARK_NEW_CUSTOMER', // not in DB but valid mobile
  CLEAR_CUSTOMER:    'CLEAR_CUSTOMER',
  SET_SUGGESTIONS:   'SET_SUGGESTIONS',
  SET_FOCUSED_SUGGESTION: 'SET_FOCUSED_SUGGESTION',
  CLOSE_SUGGESTIONS: 'CLOSE_SUGGESTIONS',

  // Payments
  ADD_PAYMENT:           'ADD_PAYMENT',
  UPDATE_PAYMENT_METHOD: 'UPDATE_PAYMENT_METHOD',
  UPDATE_PAYMENT_AMOUNT: 'UPDATE_PAYMENT_AMOUNT', // amount in paise
  REMOVE_PAYMENT:        'REMOVE_PAYMENT',
  CLEAR_PAYMENT_ERROR:   'CLEAR_PAYMENT_ERROR',
  SET_PAYMENT_STATUS:    'SET_PAYMENT_STATUS', // Manual override
  SYNC_TOTAL:            'SYNC_TOTAL',         // Sync "Paid" amount to total
  RESET_PAYMENTS:        'RESET_PAYMENTS',     // Clear all for next bill
};

// ─── Initial State ────────────────────────────────────────────────────────────

export const initialState = {
  customer: {
    mobile: '',
    name:   '',
    id:     null,
    // 'idle' | 'searching' | 'found' | 'new' | 'invalid'
    status: 'idle',
    suggestions:    [],
    focusedIndex:   -1,
    showSuggestions: false,
  },
  payments: [],  // [{ id: string, method: string, amount: number (paise) }]
  errors: {},    // { [paymentId]: string }  — per-entry validation messages

  // Status & Derived
  paymentStatus:   null, // Unselected initially
  totalPaidPaise:  0,
  balancePaise:    0,
  changePaise:     0,
};

// ─── Derivation ───────────────────────────────────────────────────────────────

/**
 * Recomputes derived payment fields.
 * totalPaise comes from the parent bill totals and must be provided by any
 * action that changes payments.  We store it transiently on state so that
 * derivePaymentState can always access it without threading it through every
 * action call site.
 */
function derivePaymentState(state, totalPaise = state._totalPaise ?? 0, manualStatus) {
  const totalPaidPaise = state.payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Manual Authority: paymentStatus only changes via SET_PAYMENT_STATUS action.
  // If manualStatus is provided (even if null), we use it. Otherwise, we keep the previous state.
  const paymentStatus = (manualStatus !== undefined) ? manualStatus : state.paymentStatus;

  const balancePaise = totalPaise > totalPaidPaise
    ? totalPaise - totalPaidPaise
    : 0;

  const changePaise = totalPaidPaise > totalPaise
    ? totalPaidPaise - totalPaise
    : 0;

  return {
    ...state,
    _totalPaise: totalPaise,
    totalPaidPaise,
    balancePaise,
    changePaise,
    paymentStatus,
  };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function billingReducer(state, action) {
  switch (action.type) {

    // ── Customer ──────────────────────────────────────────────────────────────

    case A.SET_MOBILE: {
      const mobile = String(action.payload).replace(/\D/g, '').slice(0, 10);
      return {
        ...state,
        customer: {
          ...state.customer,
          mobile,
          // Reset lookup state when user is typing a new number
          id:     null,
          status: mobile.length === 10 ? 'searching' : (mobile.length > 0 ? 'idle' : 'idle'),
          name:   state.customer.status === 'found' ? state.customer.name : '',
          showSuggestions: mobile.length >= 2,
        },
      };
    }

    case A.SET_CUSTOMER_NAME: {
      return {
        ...state,
        customer: {
          ...state.customer,
          name: action.payload,
        },
      };
    }

    case A.SELECT_CUSTOMER: {
      // action.payload = customer object from DB
      const c = action.payload;
      return {
        ...state,
        customer: {
          ...state.customer,
          mobile: c.phone || state.customer.mobile,
          name:   c.fullName || c.name || '',
          id:     c.id || c._id || null,
          status: 'found',
          suggestions:     [],
          focusedIndex:    -1,
          showSuggestions: false,
        },
      };
    }

    case A.MARK_NEW_CUSTOMER: {
      return {
        ...state,
        customer: {
          ...state.customer,
          status: 'new',
          id:     null,
          // Keep name as-is so user can type it
          suggestions:     [],
          showSuggestions: false,
        },
      };
    }

    case A.CLEAR_CUSTOMER: {
      return {
        ...state,
        customer: {
          mobile: '',
          name:   '',
          id:     null,
          status: 'idle',
          suggestions:     [],
          focusedIndex:    -1,
          showSuggestions: false,
        },
      };
    }

    case A.SET_SUGGESTIONS: {
      return {
        ...state,
        customer: {
          ...state.customer,
          suggestions:     action.payload,
          showSuggestions: action.payload.length > 0,
          focusedIndex:    -1,
        },
      };
    }

    case A.SET_FOCUSED_SUGGESTION: {
      const { suggestions } = state.customer;
      const len = suggestions.length;
      if (len === 0) return state;
      const next = ((action.payload % len) + len) % len;
      return {
        ...state,
        customer: { ...state.customer, focusedIndex: next },
      };
    }

    case A.CLOSE_SUGGESTIONS: {
      return {
        ...state,
        customer: {
          ...state.customer,
          showSuggestions: false,
          focusedIndex:    -1,
        },
      };
    }

    // ── Payments ──────────────────────────────────────────────────────────────

    case A.ADD_PAYMENT: {
      const newPayment = {
        id:     action.payload?.id ?? crypto.randomUUID(),
        method: action.payload && 'method' in action.payload ? action.payload.method : null,
        amount: action.payload?.amount ?? 0,
      };
      const next = { ...state, payments: [...state.payments, newPayment] };
      return derivePaymentState(next, action.totalPaise ?? state._totalPaise);
    }

    case A.UPDATE_PAYMENT_METHOD: {
      // action.payload = { id, method }
      const payments = state.payments.map(p =>
        p.id === action.payload.id ? { ...p, method: action.payload.method } : p
      );
      return derivePaymentState({ ...state, payments }, action.totalPaise ?? state._totalPaise);
    }

    case A.UPDATE_PAYMENT_AMOUNT: {
      // action.payload = { id, amount }  — amount in paise (integer)
      const rawAmount = action.payload.amount;

      if (rawAmount < 0) {
        return {
          ...state,
          errors: {
            ...state.errors,
            [action.payload.id]: 'Amount cannot be negative',
          },
        };
      }

      const payments = state.payments.map(p =>
        p.id === action.payload.id ? { ...p, amount: rawAmount } : p
      );
      const errors = { ...state.errors };
      delete errors[action.payload.id];

      // After a manual amount update, we preserve the CURRENT status (Manual Authority)
      return derivePaymentState({ ...state, payments, errors }, action.totalPaise ?? state._totalPaise);
    }

    case A.SET_PAYMENT_STATUS: {
      const status = action.payload;
      const total  = action.totalPaise ?? state._totalPaise ?? 0;
      return derivePaymentState(state, total, status);
    }

    case A.SYNC_TOTAL: {
      const total = action.payload;
      let payments = [...state.payments];
      if (state.paymentStatus === 'Paid' && payments.length === 1) {
        payments[0] = { ...payments[0], amount: total };
      }
      return derivePaymentState({ ...state, payments }, total);
    }

    case A.REMOVE_PAYMENT: {
      const payments = state.payments.filter(p => p.id !== action.payload);
      const errors   = { ...state.errors };
      delete errors[action.payload];
      return derivePaymentState({ ...state, payments, errors }, action.totalPaise ?? state._totalPaise);
    }

    case A.CLEAR_PAYMENT_ERROR: {
      const errors = { ...state.errors };
      delete errors[action.payload];
      return { ...state, errors };
    }

    case A.RESET_PAYMENTS: {
      return derivePaymentState({
        ...state,
        payments: [],
        errors: {},
        paymentStatus: null,
      }, action.totalPaise ?? 0);
    }

    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a rupee float to integer paise (avoids floating-point drift) */
export function rupeesToPaise(rupees) {
  return Math.round(parseFloat(rupees || 0) * 100);
}

/** Convert paise integer to formatted rupee string for display */
export function paiseToRupees(paise) {
  return (paise / 100).toFixed(2);
}

/**
 * Build the save payload from reducer state + parent bill totals.
 * This is the SINGLE place where the save payload is constructed.
 *
 * @param {object} sidebarState  — billingReducer state
 * @param {object} bill          — currentBill from BillingPage
 * @param {object} totals        — computed totals from calculateTotals
 * @param {object} enrichedCart  — enriched cart from calculateTotals
 * @param {object} customer      — resolved customer (may have DB id)
 * @returns {object}             — payload ready for addTransaction()
 */
export function buildSavePayload(sidebarState, bill, totals, enrichedCart, customer) {
  const { payments, paymentStatus, totalPaidPaise } = sidebarState;

  // Convert payments to the backend format
  const paymentsPayload = payments
    .filter(p => p.amount > 0)
    .map(p => ({
      id:     crypto.randomUUID(),
      date:   new Date(),
      method: p.method,
      amount: parseFloat(paiseToRupees(p.amount)),
    }));

  const amountReceivedRupees = parseFloat(paiseToRupees(totalPaidPaise));

  // Primary payment method = first payment entry's method (for legacy compat)
  const primaryMethod = paymentsPayload[0]?.method || '';

  return {
    customerId:     customer?.id || customer?._id || null,
    customerName:   customer?.fullName || customer?.name || 'Customer',
    customerMobile: customer?.phone || sidebarState.customer.mobile || '',
    date: new Date(),
    items: enrichedCart.map(item => ({
      productId:    item.id || item._id,
      name:         item.name,
      quantity:     item.quantity,
      price:        item.price,
      total:        item.total,
      discount:     item.discount,
      taxRate:      item.taxRate,
      taxableValue: item.taxableValue || 0,
      cgst:         item.cgst        || 0,
      sgst:         item.sgst        || 0,
      igst:         item.igst        || 0,
      totalTax:     item.totalTax    || 0,
      variantId:    item.variantId,
      hsnCode:      item.hsnCode,
      isInclusive:  item.isInclusive,
    })),
    grossTotal:        totals.grossTotal,
    itemDiscount:      totals.itemDiscount,
    subtotal:          totals.subtotal,
    tax:               totals.tax,
    discount:          totals.discount,
    additionalCharges: totals.additionalCharges,
    roundOff:          totals.roundOff,
    total:             totals.total,
    paymentMethod:     primaryMethod,
    status:            paymentStatus,
    amountReceived:    amountReceivedRupees,
    payments:          paymentsPayload,
    taxType:           bill.taxType,
    cgst:              totals.cgst || 0,
    sgst:              totals.sgst || 0,
    igst:              totals.igst || 0,
    remarks:           bill.remarks           || '',
    billDiscount:      bill.billDiscount       || 0,
    loyaltyPointsDiscount: bill.loyaltyPointsDiscount || 0,
  };
}
