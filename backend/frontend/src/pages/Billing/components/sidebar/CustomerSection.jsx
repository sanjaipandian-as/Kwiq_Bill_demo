import React, { useRef, useEffect } from 'react';
import { Phone, User, CheckCircle, X } from 'lucide-react';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import { cn } from '../../../../lib/utils';
import { useCustomers } from '../../../../context/CustomerContext';
import { A } from './billingReducer';

/**
 * CustomerSection
 *
 * Progressive customer capture:
 *   1. Mobile input → lookup → autofill name if found, else mark as new
 *   2. Name input (shown once 10-digit mobile is entered)
 *
 * All state updates go through dispatch. No local useState for related logic.
 * Suggestions use a roving-ref approach for scroll-into-view (not tabIndex —
 * the list is an aria-listbox pattern, keyboard nav via keydown on the input).
 */
export default function CustomerSection({
  customer,       // state.customer slice
  dispatch,
  onNameRef,      // callback(ref) so parent can focus name later
  onMobileRef,    // callback(ref) so parent controls focus
  requireMobile,
}) {
  const { getCustomerByMobile, customers } = useCustomers();

  const mobileRef  = useRef(null);
  const nameRef    = useRef(null);
  const dropdownRef = useRef(null);
  const itemRefs   = useRef([]);

  // Expose refs upward — using callback refs is more reliable for conditional rendering

  // Auto-focus on mount
  useEffect(() => {
    if (requireMobile && mobileRef.current) {
      mobileRef.current.focus();
    }
  }, [requireMobile]);

  // Scroll focused suggestion into view
  useEffect(() => {
    const idx = customer.focusedIndex;
    if (idx >= 0 && itemRefs.current[idx]) {
      itemRefs.current[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [customer.focusedIndex]);

  // Close suggestions on outside click (scoped to this component — no global listener)
  useEffect(() => {
    const handleOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        mobileRef.current &&
        !mobileRef.current.contains(e.target)
      ) {
        dispatch({ type: A.CLOSE_SUGGESTIONS });
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [dispatch]);

  // ── Derived display helpers ────────────────────────────────────────────────
  const isFound    = customer.status === 'found';
  const isNew      = customer.status === 'new';
  const isSearching = customer.status === 'searching';

  const mobileError =
    customer.mobile.length > 0 && customer.mobile.length < 10
      ? 'Must be 10 digits'
      : '';

  // Compute suggestions from context — event-driven, matches locally when typing
  const suggestions = customer.suggestions;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleMobileChange = async (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    dispatch({ type: A.SET_MOBILE, payload: raw });

    // Compute suggestions locally for immediate feedback
    if (raw.length >= 2) {
      const q = raw.toLowerCase();
      const matches = customers
        .filter(c => {
          const name  = (c.fullName || c.name || '').toLowerCase();
          const phone = (c.phone || '').toLowerCase();
          return name.includes(q) || phone.includes(q);
        })
        .slice(0, 5);
      dispatch({ type: A.SET_SUGGESTIONS, payload: matches });
    } else {
      dispatch({ type: A.SET_SUGGESTIONS, payload: [] });
    }

    // If exactly 10 digits, do async DB lookup
    if (raw.length === 10) {
      try {
        const found = await getCustomerByMobile(raw);
        if (found) {
          dispatch({ type: A.SELECT_CUSTOMER, payload: found });
        } else {
          dispatch({ type: A.MARK_NEW_CUSTOMER });
        }
      } catch {
        dispatch({ type: A.MARK_NEW_CUSTOMER });
      }
    }
  };

  const selectSuggestion = (suggestion) => {
    dispatch({ type: A.SELECT_CUSTOMER, payload: suggestion });
    // Focus name field if it's a new suggested customer (unusual) or just move forward
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const handleMobileKeyDown = (e) => {
    const { suggestions, focusedIndex, showSuggestions } = customer;

    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        dispatch({ type: A.SET_FOCUSED_SUGGESTION, payload: focusedIndex + 1 });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        dispatch({ type: A.SET_FOCUSED_SUGGESTION, payload: focusedIndex - 1 });
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedIndex >= 0) {
          selectSuggestion(suggestions[focusedIndex]);
        } else {
          dispatch({ type: A.CLOSE_SUGGESTIONS });
          nameRef.current?.focus();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: A.CLOSE_SUGGESTIONS });
        return;
      }
    }

    // No suggestions open — move forward
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      nameRef.current?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Go back to the main product search bar
      document.getElementById('main-search-input')?.focus();
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      mobileRef.current?.focus();
    }
    // Forward / Enter handled by parent via onNameEnter prop
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      // Bubble up via a custom event so the parent BillingSidebar can
      // direct focus to the first payment entry
      nameRef.current?.dispatchEvent(new CustomEvent('sidebar:name-enter', { bubbles: true }));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
          Customer {requireMobile && '*'}
        </label>
        {(isFound || isNew) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-[10px] text-slate-400 hover:text-black"
            onClick={() => {
              dispatch({ type: A.CLEAR_CUSTOMER });
              setTimeout(() => mobileRef.current?.focus(), 50);
            }}
          >
            <X size={12} className="mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Mobile Input */}
      <div className="relative">
        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <Input
          id="customer-mobile-input"
          ref={(el) => {
            mobileRef.current = el;
            onMobileRef?.(el);
          }}
          type="tel"
          placeholder="Enter 10-digit mobile *"
          value={customer.mobile}
          onChange={handleMobileChange}
          onKeyDown={handleMobileKeyDown}
          onFocus={() => {
            if (customer.mobile.length >= 2 && customer.suggestions.length > 0) {
              dispatch({ type: A.SET_SUGGESTIONS, payload: customer.suggestions });
            }
          }}
          maxLength={10}
          readOnly={isFound}
          className={cn(
            'pl-9 h-9 text-sm focus-visible:ring-0 focus-visible:border-black focus-visible:border-[3px]',
            mobileError && 'border-red-500 focus-visible:border-red-600',
            isFound && 'border-green-500 bg-green-50 cursor-not-allowed',
          )}
        />
        {isFound && (
          <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" size={16} />
        )}

        {/* Suggestions Dropdown */}
        {customer.showSuggestions && suggestions.length > 0 && !isFound && (
          <div
            ref={dropdownRef}
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-60 overflow-auto"
          >
            {suggestions.map((s, idx) => (
              <div
                key={s.id || s._id || idx}
                ref={el => (itemRefs.current[idx] = el)}
                role="option"
                aria-selected={idx === customer.focusedIndex}
                className={cn(
                  'flex items-center justify-between p-3 cursor-pointer border-b border-zinc-100 last:border-0 transition-colors',
                  idx === customer.focusedIndex
                    ? 'bg-zinc-900 text-white'
                    : 'hover:bg-zinc-50',
                )}
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                onMouseEnter={() => dispatch({ type: A.SET_FOCUSED_SUGGESTION, payload: idx })}
              >
                <div className="flex items-center gap-2">
                  <User size={14} className={idx === customer.focusedIndex ? 'text-zinc-300' : 'text-slate-400'} />
                  <span className={cn('font-medium', idx === customer.focusedIndex ? 'text-white' : 'text-slate-800')}>
                    {s.fullName || s.name || 'Unknown'}
                  </span>
                </div>
                <div className={cn('flex items-center gap-1 text-sm font-mono', idx === customer.focusedIndex ? 'text-zinc-300' : 'text-slate-500')}>
                  <Phone size={12} />
                  {s.phone}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation / status messages */}
      {mobileError && (
        <p className="text-xs text-red-500">⚠ {mobileError}</p>
      )}
      {isSearching && (
        <p className="text-xs text-zinc-400">Searching...</p>
      )}
      {isFound && !mobileError && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle size={12} /> Existing customer
        </p>
      )}
      {isNew && customer.mobile.length === 10 && (
        <p className="text-xs text-blue-600">→ New customer will be created</p>
      )}

      {/* Name Input — shown as soon as we have a valid mobile */}
      {customer.mobile.length === 10 && !mobileError && (
        <>
          <Input
            id="customer-name-input"
            ref={(el) => {
              nameRef.current = el;
              onNameRef?.(el);
            }}
            placeholder="Customer Name (required) *"
            value={customer.name}
            onChange={e => dispatch({ type: A.SET_CUSTOMER_NAME, payload: e.target.value })}
            onKeyDown={handleNameKeyDown}
            readOnly={isFound}
            className={cn(
              'h-9 text-sm focus-visible:ring-0 focus-visible:border-black focus-visible:border-[3px]',
              !customer.name.trim() && 'border-neutral-300 bg-neutral-50',
              isFound && 'bg-green-50 cursor-not-allowed border-green-500',
            )}
          />
          {!customer.name.trim() && (
            <p className="text-xs text-neutral-500">⚠ Name is required to save bill</p>
          )}
        </>
      )}
    </div>
  );
}
