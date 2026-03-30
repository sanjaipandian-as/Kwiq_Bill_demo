const Razorpay = require('razorpay');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const Payment = require('../models/paymentModel');
const AuditLog = require('../models/auditLogModel');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Debug: Verify key loading
console.log(`[PAYMENT-INIT] Razorpay initialized with Key ID: ${process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.substring(0, 8) + '...' : 'MISSING'}`);

// @desc    Create a Razorpay order with strict security
// @route   POST /api/payment/order
// @access  Public
const createOrder = asyncHandler(async (req, res) => {
    const { amount, currency = 'INR', email = 'anonymous', description = 'Donation' } = req.body;

    // 1. Strict Amount Validation (Min: ₹10, Max: ₹50,000)
    if (!amount || isNaN(amount) || amount < 10 || amount > 50000) {
        res.status(400);
        throw new Error('Amount must be between ₹10 and ₹50,000');
    }

    const receipt = `RCPT_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const options = {
        amount: Math.round(amount * 100), // convert to paise
        currency,
        receipt,
        notes: {
            email,
            description
        }
    };

    try {
        console.log(`[PAYMENT-ORDER] Attempting to create order for Amount: ₹${amount} (${options.amount} paise)`);
        const order = await razorpay.orders.create(options);
        
        console.log(`[PAYMENT-ORDER] Success! Order ID: ${order.id}`);
        
        // 2. Persist order intent into DB (Pending state)
        await Payment.create({
            orderId: order.id,
            amount,
            currency,
            email,
            receiptId: receipt,
            description,
            status: 'pending'
        });

        // 3. Audit Logging
        console.log(`[PAYMENT-INTENT] Generated order ${order.id} for ${email} - Amount: ₹${amount}`);

        res.status(201).json({
            success: true,
            order,
        });
    } catch (error) {
        console.error("Razorpay Order Creation Failed:", error);
        res.status(500);
        throw new Error('Payment server initialization failed. Please try again.');
    }
});

// @desc    Verify Razorpay payment with high security checks
// @route   POST /api/payment/verify
// @access  Public
const verifyPayment = asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400);
        throw new Error('Mandatory payment parameters missing');
    }

    // 1. Fetch order from DB to verify it exists and hasn't been paid
    const storedPayment = await Payment.findOne({ orderId: razorpay_order_id });
    if (!storedPayment) {
        res.status(404);
        throw new Error('Transaction record not found. Fraud suspicion.');
    }

    if (storedPayment.status === 'paid') {
        res.status(400);
        throw new Error('Transaction already finalized. Duplicate attempt blocked.');
    }

    // 2. Prevent brute force signature guessing
    if (storedPayment.verificationAttempts >= 10) {
        res.status(403);
        throw new Error('Too many failed verification attempts for this order.');
    }

    // 3. Re-calculate HMAC Signature (Server-side)
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    const isSecureMatch = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpay_signature)
    );

    if (isSecureMatch) {
        // 4. Update Database to 'paid' status
        storedPayment.status = 'paid';
        storedPayment.paymentId = razorpay_payment_id;
        await storedPayment.save();

        // 5. Hard Audit Logging
        if (AuditLog) {
          await AuditLog.create({
              action: 'DONATION_SUCCESS',
              targetType: 'PAYMENT',
              targetId: storedPayment._id,
              details: `Successful donation of ₹${storedPayment.amount} from ${storedPayment.email}. Order: ${razorpay_order_id}`
          });
        }

        res.status(200).json({
            success: true,
            message: 'Payment verified and secured successfully',
        });
    } else {
        // 6. Track failed attempt
        storedPayment.verificationAttempts += 1;
        await storedPayment.save();

        res.status(400);
        throw new Error('Secure payment verification failed. Digital signature mismatch.');
    }
});

// @desc    Get all payments (Admin specific)
// @route   GET /api/payment/all
// @access  Admin
const getAllPayments = asyncHandler(async (req, res) => {
    // Admin Master Key validation is basic for the demo
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== (process.env.ADMIN_MANAGEMENT_KEY || 'KWIQ_ADMIN_MASTER_2026')) {
        res.status(401);
        throw new Error('Not authorized. Admin Master Key required.');
    }

    const payments = await Payment.find({}).sort({ createdAt: -1 });
    res.status(200).json(payments);
});

module.exports = {
    createOrder,
    verifyPayment,
    getAllPayments
};
