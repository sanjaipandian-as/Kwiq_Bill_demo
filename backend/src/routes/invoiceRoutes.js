const express = require('express');
const router = express.Router();
const {
    getInvoices,
    getInvoiceById,
    createInvoice,
    deleteInvoice,
    restoreInvoice,
    getInvoiceStats,
    updateInvoice,
    bulkDeleteInvoices
} = require('../controllers/invoiceController');
const { protect } = require('../middleware/authMiddleware');
const { checkTrial } = require('../middleware/trialMiddleware');

router.route('/').get(protect, checkTrial, getInvoices).post(protect, checkTrial, createInvoice);
router.route('/bulk-delete').post(protect, checkTrial, bulkDeleteInvoices);
router.route('/stats').get(protect, checkTrial, getInvoiceStats);
router.post('/:id/restore', protect, checkTrial, restoreInvoice);
router.route('/:id').get(protect, checkTrial, getInvoiceById).put(protect, checkTrial, updateInvoice).delete(protect, checkTrial, deleteInvoice);

module.exports = router;
