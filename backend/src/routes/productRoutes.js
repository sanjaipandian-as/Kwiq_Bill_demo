const express = require('express');
const router = express.Router();
const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    restoreProduct,
    fixIndexes,
    getProductStats
} = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');
const { checkTrial } = require('../middleware/trialMiddleware');

// Temp route to fix indexes - Ensure this is placed BEFORE /:id
router.get('/fix-indexes', fixIndexes);

router.route('/').get(protect, checkTrial, getProducts).post(protect, checkTrial, createProduct);

router.get('/:id/stats', protect, checkTrial, getProductStats);
router.post('/:id/restore', protect, checkTrial, restoreProduct);

router
    .route('/:id')
    .get(protect, checkTrial, getProductById)
    .put(protect, checkTrial, updateProduct)
    .delete(protect, checkTrial, deleteProduct);

module.exports = router;
