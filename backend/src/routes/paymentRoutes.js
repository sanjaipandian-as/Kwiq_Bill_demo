const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, getAllPayments } = require('../controllers/paymentController');
// const { protect } = require('../middleware/authMiddleware');

// For test mode, keep it semi-public or use protection if user is logged in
// Based on current setup, just use simple routes
router.post('/order', createOrder);
router.post('/verify', verifyPayment);
router.get('/all', getAllPayments);

module.exports = router;
