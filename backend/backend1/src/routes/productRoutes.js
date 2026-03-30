const express = require("express");
const router = express.Router();

const {
  getProducts,
  createProduct,
  updateStock,
  updateProduct,
  deleteProduct,
  getProductStats,
  getProductById,
  fixVariants,
  migrateSchema,
  createManyProducts,
  deleteManyProducts
} = require("../controllers/productController");

const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getProducts);
router.post("/bulk", protect, createManyProducts);
router.post("/bulk-delete", protect, deleteManyProducts);
router.post("/fix-variants", protect, fixVariants);
// router.post("/migrate-schema", migrateSchema); // Moved to authRoutes
// Specific routes first to avoid catching generic IDs
router.get("/:id/stats", protect, getProductStats);
router.put("/:id/stock", protect, updateStock);

// Generic ID routes
router.get("/:id", protect, getProductById);
router.put("/:id", protect, updateProduct);
router.delete("/:id", protect, deleteProduct);

module.exports = router;
