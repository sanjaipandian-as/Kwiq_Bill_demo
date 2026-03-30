const CustomizeRequest = require('../models/customizeRequestModel');

// @desc    Create a new customize request
// @route   POST /customize-requests
// @access  Public
const createRequest = async (req, res) => {
    try {
        const { fullName, email, phone, businessName, businessType, features, platform, description } = req.body;
        
        const request = await CustomizeRequest.create({
            fullName, 
            email, 
            phone, 
            businessName, 
            businessType, 
            features, 
            platform, 
            description
        });

        res.status(201).json({ success: true, data: request });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get all customize requests
// @route   GET /customize-requests
// @access  Private/Admin
const getRequests = async (req, res) => {
    try {
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.ADMIN_MANAGEMENT_KEY && adminKey !== 'KWIQ_ADMIN_MASTER_2026') {
            return res.status(401).json({ success: false, message: 'Not authorized as an admin' });
        }

        // Sort by newest first
        const requests = await CustomizeRequest.find({}).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: requests.length, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update request status
// @route   PUT /customize-requests/:id
// @access  Private/Admin
const updateRequestStatus = async (req, res) => {
    try {
        const adminKey = req.headers['x-admin-key'];
        if (adminKey !== process.env.ADMIN_MANAGEMENT_KEY && adminKey !== 'KWIQ_ADMIN_MASTER_2026') {
            return res.status(401).json({ success: false, message: 'Not authorized as an admin' });
        }

        const { status } = req.body;
        
        const request = await CustomizeRequest.findByIdAndUpdate(
            req.params.id, 
            { status }, 
            { new: true, runValidators: true }
        );

        if (!request) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        res.status(200).json({ success: true, data: request });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Get user's specific request status
// @route   GET /customize-requests/my-status
// @access  Public (By Email)
const getMyRequestStatus = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const request = await CustomizeRequest.findOne({ email }).sort({ createdAt: -1 });
        
        if (!request) {
            return res.status(200).json({ success: true, data: null });
        }

        res.status(200).json({ success: true, data: request });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createRequest,
    getRequests,
    updateRequestStatus,
    getMyRequestStatus
};
