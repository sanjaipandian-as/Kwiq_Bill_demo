const express = require("express");
const router = express.Router();

const {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoiceStats,
  bulkDelete,
  recalculateData,
  uncancelInvoice,
  bulkUncancel,
  permanentDeleteInvoice,
  bulkPermanentDelete,
} = require("../controllers/invoiceController");

const { protect } = require("../middleware/authMiddleware");

router.get("/stats", protect, getInvoiceStats);
router.get("/:id", protect, getInvoiceById);
router.put("/:id", protect, updateInvoice);
router.delete("/:id", protect, deleteInvoice);
router.post("/:id/uncancel", protect, uncancelInvoice);
router.get("/", protect, getInvoices);
router.post("/", protect, createInvoice);
router.post("/bulk-delete", protect, bulkDelete);
router.post("/bulk-uncancel", protect, bulkUncancel);
router.post("/bulk-permanent-delete", protect, bulkPermanentDelete);
router.post("/recalculate", protect, recalculateData);
router.delete("/:id/permanent", protect, permanentDeleteInvoice);

module.exports = router;
