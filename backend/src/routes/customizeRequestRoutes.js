const express = require('express');
const router = express.Router();
const { createRequest, getRequests, updateRequestStatus, getMyRequestStatus } = require('../controllers/customizeRequestController');


router.post('/', createRequest);
router.get('/my-status', getMyRequestStatus);
router.get('/', getRequests);
router.put('/:id', updateRequestStatus);

module.exports = router;
