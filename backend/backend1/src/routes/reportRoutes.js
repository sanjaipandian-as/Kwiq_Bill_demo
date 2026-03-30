const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const {
  getDashboardStats,
  getFinancials,
  getTopProducts,
  getPaymentMethods,
  getSalesTrend,
  getCustomerMetrics
} = require("../controllers/reportController");

router.get("/dashboard", protect, getDashboardStats);
router.get("/financials", protect, getFinancials);
router.get("/top-products", protect, getTopProducts);
router.get("/payment-methods", protect, getPaymentMethods);
router.get("/sales-trend", protect, getSalesTrend);
router.get("/customers", protect, getCustomerMetrics);

module.exports = router;
