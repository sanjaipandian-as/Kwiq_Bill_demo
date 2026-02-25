const express = require('express');
const router = express.Router();
const {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    restoreExpense,
    bulkUpdateExpenses,
    bulkDeleteExpenses,
    exportExpensesToCSV,
    uploadReceipt,
} = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');
const { checkTrial } = require('../middleware/trialMiddleware');
const { upload } = require('../config/cloudinary');

// Main routes
router.route('/').get(protect, checkTrial, getExpenses).post(protect, checkTrial, createExpense);
router.route('/:id').put(protect, checkTrial, updateExpense).delete(protect, checkTrial, deleteExpense);
router.post('/:id/restore', protect, checkTrial, restoreExpense);

// Bulk operations
router.post('/bulk-update', protect, checkTrial, bulkUpdateExpenses);
router.post('/bulk-delete', protect, checkTrial, bulkDeleteExpenses);

// CSV export
router.get('/export/csv', protect, checkTrial, exportExpensesToCSV);

// Receipt upload with error handling
router.post('/:id/receipt', protect, checkTrial, (req, res, next) => {
    upload.single('receipt')(req, res, (err) => {
        if (err) {
            console.error('Upload Error:', err);
            return res.status(400).json({ message: err.message });
        }
        next();
    });
}, uploadReceipt);

module.exports = router;
