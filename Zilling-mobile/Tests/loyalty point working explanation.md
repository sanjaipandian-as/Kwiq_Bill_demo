# Loyalty Points System Documentation

This document explains the working logic of the Loyalty Points System implemented in the Kwiq Bill application.

## 1. Earning Rules
- **Rate**: Customers earn **1 point for every ₹10 spent**.
- **Calculation Basis**: Points are calculated on the **Original Subtotal** (before any tax, shipping, or bill-level discounts).
- **Rounding**: Decimal points are rounded down using `Math.floor()`.
    - *Example*: A subtotal of ₹488 earns `Math.floor(488 / 10) = 48 points`.
- **Minimum Purchase**: There is no minimum purchase required to earn points.
- **Sustainability**: Points are earned even on transactions where existing points are redeemed.

## 2. Redemption Rules
- **Rate**: **100 points = ₹10 Discount** (Conversion: 1 point = ₹0.10).
- **Minimum Redemption**: A minimum of **100 points** must be redeemed in a single transaction.
- **Multiples Rule**: Points must be redeemed in **multiples of 100** (e.g., 100, 200, 300, 400...).
- **Maximum Cap**: The discount from loyalty points cannot exceed **50% of the subtotal amount**.
- **Immediate Effect**: Points are deducted from the customer's balance immediately upon invoice finalization.

## 3. Invoice Calculation Workflow
When a customer chooses to redeem points, the application follows this strict mathematical sequence:

1.  **Original Subtotal**: Sum of all items (Price × Quantity - Item Discounts).
2.  **Loyalty Discount**: Points to Redeem × 0.1.
3.  **Net Taxable Value**: `Original Subtotal - Loyalty Discount`.
4.  **Tax Calculation**: GST is calculated on the **Net Taxable Value** (Post-loyalty discount).
5.  **Total Payable**: `Net Taxable Value + Tax + Additional Charges - Bill Discount`.
6.  **Points Earned**: `Math.floor(Original Subtotal / 10)`.
7.  **Balance Update**: `New Balance = Old Balance - Redeemed Points + Earned Points`.

## 4. UI/UX Features
- **Validation**: The "Redeem Loyalty" modal prevents entering points that exceed the available balance, the 50% discount cap, or that are not multiples of 100.
- **Visibility**: The Loyalty Reward is displayed as a separate line item in the billing dashboard and printed on the invoice.
- **Transparency**: Customers can see their available balance and max redeemable points directly in the redemption screen.

---
*This system ensures high customer retention while maintaining clear tax compliance and profitability.*
