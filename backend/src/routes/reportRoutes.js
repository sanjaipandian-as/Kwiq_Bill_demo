const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getFinancials,
    getSalesTrend,
    getPaymentMethods,
    getTopProducts,
    getCustomerMetrics
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { checkTrial } = require('../middleware/trialMiddleware');

router.get('/dashboard', protect, checkTrial, getDashboardStats);
router.get('/financials', protect, checkTrial, getFinancials);
router.get('/sales-trend', protect, checkTrial, getSalesTrend);
router.get('/payment-methods', protect, checkTrial, getPaymentMethods);
router.get('/top-products', protect, checkTrial, getTopProducts);
router.get('/customers', protect, checkTrial, getCustomerMetrics);

module.exports = router;
