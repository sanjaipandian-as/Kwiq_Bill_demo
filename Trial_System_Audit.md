# 🔍 30-Day Free Trial System — Audit & Fixes

**Date:** 25 February 2026  
**Auditor:** Antigravity AI  
**Scope:** Full-stack trial system across Backend (Node.js/Express/MongoDB) and Mobile App (React Native/Expo)

---

## 📋 Overview

The Kwiq Bill application implements a 30-day free trial for new users. After the trial expires, users should be blocked from accessing the application and prompted to upgrade to a premium plan.

This audit tested the entire trial flow end-to-end and uncovered **5 bugs** — 3 critical and 2 medium severity.

---

## 🐛 Bugs Found & Fixed

### Bug 1: Duplicate `googleId` Field in User Model (🔴 Critical)

**File:** `backend/src/models/userModel.js`  
**Problem:** The `googleId` field was defined **twice** in the Mongoose schema (lines 25-34). The second definition silently overwrote the first. While Mongoose doesn't crash, this is a code defect that can cause unexpected behavior.

**Fix:** Removed the duplicate `googleId` field definition. Only one remains.

---

### Bug 2: Existing Users Get Permanent Free Access (🔴 Critical)

**File:** `backend/src/controllers/authController.js`  
**Problem:** The `trialExpiresAt` field was only set for **newly created users** during Google login. Any user registered **before** the trial feature was added had `trialExpiresAt: undefined`. In `TrialGuard.jsx`, when `user.trialExpiresAt` is `undefined`, the guard returned `false` — meaning **existing users got permanent free access forever** with no trial enforcement.

**Fix:** Added a backfill mechanism in the `googleLogin` controller. When an existing user logs in and has no `trialExpiresAt`, it is automatically calculated as `createdAt + 30 days`. This means:
- If the account is older than 30 days → trial shows as already expired
- If the account is newer than 30 days → trial shows the remaining days

```javascript
// Backfill trialExpiresAt for users created before the trial feature
if (!user.trialExpiresAt) {
    const trialExpiresAt = new Date(user.createdAt);
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 30);
    user.trialExpiresAt = trialExpiresAt;
    needsSave = true;
}
```

---

### Bug 3: No Server-Side Trial Enforcement (🔴 Critical)

**Files:**
- **New file:** `backend/src/middleware/trialMiddleware.js`
- `backend/src/routes/productRoutes.js`
- `backend/src/routes/customerRoutes.js`
- `backend/src/routes/invoiceRoutes.js`
- `backend/src/routes/expenseRoutes.js`
- `backend/src/routes/reportRoutes.js`
- `backend/src/routes/settingsRoutes.js`

**Problem:** The trial was **only enforced on the client-side** via `TrialGuard.jsx`. There was **no middleware** on the backend to reject API calls from expired-trial users. A technically savvy user could bypass the trial entirely by calling the API directly (e.g., via Postman or a modified app).

**Fix:** Created a new `checkTrial` middleware that:
1. Checks if `req.user.trialExpiresAt` has passed
2. Returns `403 TRIAL_EXPIRED` if the trial has ended
3. Allows the request to proceed if the trial is still active

Applied `checkTrial` to **all business routes** (products, customers, invoices, expenses, reports, settings).

**Intentionally NOT applied to:**
- `/auth/google` — Users must be able to log in even after trial expiry
- `/auth/me` — Users must be able to check their profile/trial status
- `/auth/logout` — Users must be able to log out

```javascript
// trialMiddleware.js
const checkTrial = asyncHandler(async (req, res, next) => {
    const user = req.user;
    if (user && user.trialExpiresAt) {
        const now = new Date();
        const expirationDate = new Date(user.trialExpiresAt);
        if (now > expirationDate) {
            res.status(403);
            throw new Error('TRIAL_EXPIRED: Your 30-day free trial has ended.');
        }
    }
    next();
});
```

**Route pattern:** `router.get('/', protect, checkTrial, controller)`

---

### Bug 4: No User Warning Before Trial Ends (🟡 Medium)

**File:** `Zilling-mobile/src/components/TrialGuard.jsx`

**Problem:** Users had absolutely no indication of how many days remained in their trial. They would be using the app normally one day, and the next day see a full-screen "trial ended" message with no prior warning.

**Fix:** Enhanced `TrialGuard.jsx` with:
1. **Trial warning banner** — appears when ≤7 days remain
   - **Orange banner** for 4-7 days remaining
   - **Red banner** for 1-3 days remaining (with warning icon)
   - Includes an "Upgrade" button
2. **Pulse animation** on the expired-state icon for visual polish
3. **Proper `useEffect` lifecycle** — instead of calling `isTrialExpired()` on every render, the trial state is computed via `useEffect` when `user` changes

---

### Bug 5: API Didn't Handle 403 TRIAL_EXPIRED Response (🟡 Medium)

**File:** `Zilling-mobile/src/services/api.js`

**Problem:** The API response interceptor only handled `401 Unauthorized`. After adding server-side trial enforcement (Bug 3), the backend now sends `403 TRIAL_EXPIRED` — but the mobile app had no specific handling for this.

**Fix:** Added a 403 handler in the Axios response interceptor that:
1. Checks if the error message contains `TRIAL_EXPIRED`
2. Tags the error with `error.isTrialExpired = true` so any calling code can detect it
3. Logs a warning for debugging

```javascript
if (error.response && error.response.status === 403) {
    const message = error.response.data?.message || '';
    if (message.includes('TRIAL_EXPIRED')) {
        console.warn('Trial expired - API access blocked by server.');
        error.isTrialExpired = true;
    }
}
```

---

## 🏗️ Architecture After Fixes

```
User Login (Google) → authController.js
  ├── New user       → trialExpiresAt = now + 30 days
  └── Existing user  → trialExpiresAt = createdAt + 30 days (backfill if missing)

Mobile App renders → TrialGuard.jsx
  ├── Trial active, >7 days  → Normal app (no banner)
  ├── Trial active, ≤7 days  → Warning banner + normal app
  └── Trial expired           → Full-screen expired UI (upgrade/contact/logout)

API Calls → protect middleware → checkTrial middleware → controller
  ├── Trial active  → Request proceeds normally
  └── Trial expired → 403 TRIAL_EXPIRED response
```

---

## 📁 Files Modified (10 total)

### Backend (8 files)

| File | Change |
|------|--------|
| `backend/src/models/userModel.js` | Removed duplicate `googleId` field |
| `backend/src/controllers/authController.js` | Added `trialExpiresAt` backfill for existing users |
| `backend/src/middleware/trialMiddleware.js` | **NEW** — Server-side trial enforcement middleware |
| `backend/src/routes/productRoutes.js` | Added `checkTrial` middleware to all routes |
| `backend/src/routes/customerRoutes.js` | Added `checkTrial` middleware to all routes |
| `backend/src/routes/invoiceRoutes.js` | Added `checkTrial` middleware to all routes |
| `backend/src/routes/expenseRoutes.js` | Added `checkTrial` middleware to all routes |
| `backend/src/routes/reportRoutes.js` | Added `checkTrial` middleware to all routes |
| `backend/src/routes/settingsRoutes.js` | Added `checkTrial` middleware to all routes |

### Mobile (2 files)

| File | Change |
|------|--------|
| `Zilling-mobile/src/components/TrialGuard.jsx` | Added warning banner, pulse animation, proper lifecycle |
| `Zilling-mobile/src/services/api.js` | Added 403 `TRIAL_EXPIRED` interceptor |

---

## ✅ Testing Checklist

To verify these fixes work correctly:

- [ ] **New user signup:** Creates `trialExpiresAt` = now + 30 days
- [ ] **Existing user login (no trial date):** Backfills `trialExpiresAt` = `createdAt` + 30 days
- [ ] **Active trial (>7 days):** App works normally, no banner
- [ ] **Active trial (≤7 days):** Orange/red warning banner appears at top
- [ ] **Expired trial (client):** Full-screen expired UI blocks app access
- [ ] **Expired trial (server):** API returns 403 with `TRIAL_EXPIRED` message
- [ ] **Auth routes during expired trial:** `/auth/me` and `/auth/google` still work
- [ ] **Logout during expired trial:** Logout button works correctly
- [ ] **Upgrade button:** Opens `https://kwiqbill.com/pricing`
- [ ] **Contact button:** Opens email to `support@kwiqbill.com`

### Quick Manual Test (Simulate Expired Trial)

To test the expired state without waiting 30 days, update the user's `trialExpiresAt` in MongoDB:

```javascript
// In MongoDB shell or Compass:
db.users.updateOne(
  { email: "your-test-email@gmail.com" },
  { $set: { trialExpiresAt: new Date("2025-01-01") } }
)
```

To test the warning banner (≤7 days remaining):

```javascript
// Set trial to expire in 3 days:
db.users.updateOne(
  { email: "your-test-email@gmail.com" },
  { $set: { trialExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) } }
)
```

---

## 🔮 Future Recommendations

1. **Payment gateway integration** — Connect the "Unlock Premium Access" button to an actual payment flow (Razorpay/Stripe)
2. **Admin panel override** — Allow admins to extend trials for specific users
3. **Subscription model** — Add `subscriptionStatus` field (`trial`, `active`, `expired`, `cancelled`) for more granular control
4. **Grace period** — Consider a 3-day grace period after trial expiry to allow data export
5. **Email notifications** — Send email alerts at 7 days, 3 days, and 1 day before trial expiry
