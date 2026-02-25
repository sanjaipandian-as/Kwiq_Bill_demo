const express = require('express');
const router = express.Router();
const {
    getCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    restoreCustomer,
    searchDuplicates,
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');
const { checkTrial } = require('../middleware/trialMiddleware');

router.route('/').get(protect, checkTrial, getCustomers).post(protect, checkTrial, createCustomer);
router.route('/search-duplicates').get(protect, checkTrial, searchDuplicates);
router.route('/:id/restore').post(protect, checkTrial, restoreCustomer);
router
    .route('/:id')
    .get(protect, checkTrial, getCustomerById)
    .put(protect, checkTrial, updateCustomer)
    .delete(protect, checkTrial, deleteCustomer);

module.exports = router;
