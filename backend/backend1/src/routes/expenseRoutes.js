const express = require("express");
const router = express.Router();
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  bulkUpdateExpenses,
  bulkDeleteExpenses,
  uploadReceipt
} = require("../controllers/expenseController");

const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getExpenses);
router.post("/", protect, createExpense);
router.put("/:id", protect, updateExpense);
router.delete("/:id", protect, deleteExpense);
router.post("/bulk-update", protect, bulkUpdateExpenses);
router.post("/bulk-delete", protect, bulkDeleteExpenses);
router.post("/:id/receipt", protect, upload.single("receipt"), uploadReceipt);

module.exports = router;
