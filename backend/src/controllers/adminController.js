const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const AuditLog = require('../models/auditLogModel');
const Revenue = require('../models/revenueModel');
const Broadcast = require('../models/broadcastModel');
const Backup = require('../models/backupModel');
const os = require('os');
const mongoose = require('mongoose');

// @desc    Get all users for admin management
// @route   GET /admin/users
// @access  Admin (Manual verify for now)
const getAllUsers = asyncHandler(async (req, res) => {
    // Basic protection: check for admin key in headers
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_MANAGEMENT_KEY) {
        res.status(401);
        throw new Error('Not authorized as an admin');
    }

    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
});

// @desc    Update user subscription plan
// @route   PUT /admin/users/:id/plan
// @access  Admin
const updateUserPlan = asyncHandler(async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_MANAGEMENT_KEY) {
        res.status(401);
        throw new Error('Not authorized as an admin');
    }

    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const { plan, durationMonths } = req.body;
    
    if (!['free', '1m', '3m', '1y', '3y', '5y'].includes(plan)) {
        res.status(400);
        throw new Error('Invalid plan type');
    }

    user.plan = plan;
    
    // Calculate new expiry date if duration provided, else just set to now + months
    const expiry = new Date();
    let updates = { plan };

    if (plan === '1m') expiry.setMonth(expiry.getMonth() + 1);
    else if (plan === '3m') expiry.setMonth(expiry.getMonth() + 3);
    else if (plan === '1y') expiry.setFullYear(expiry.getFullYear() + 1);
    else if (plan === '3y') expiry.setFullYear(expiry.getFullYear() + 3);
    else if (plan === '5y') expiry.setFullYear(expiry.getFullYear() + 5);
    else {
        // free - 30 days trial
        expiry.setDate(expiry.getDate() + 30);
        updates.trialExpiresAt = expiry;
    }

    updates.planExpiresAt = expiry;

    const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true }
    );

    // LOG ACTION
    await AuditLog.create({
        action: 'PLAN_UPDATE',
        targetType: 'USER',
        targetId: user._id,
        details: `Upgraded to ${plan.toUpperCase()} tier for ${user.email}`
    });

    // RECORD REVENUE
    const planPrices = { '1m': 49, '3m': 129, '1y': 399, '3y': 999, '5y': 1499, 'free': 0 };
    if (planPrices[plan] > 0) {
        await Revenue.create({
            userId: user._id,
            planId: plan,
            amount: planPrices[plan]
        });
    }

    res.json({ message: 'Plan updated successfully', user: updatedUser });
});

// @desc    Block or Unblock a user
// @route   PUT /admin/users/:id/block
// @access  Admin
const toggleUserBlock = asyncHandler(async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_MANAGEMENT_KEY) {
        res.status(401);
        throw new Error('Not authorized as an admin');
    }

    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    // LOG ACTION
    await AuditLog.create({
        action: user.isBlocked ? 'USER_BLOCK' : 'USER_UNBLOCK',
        targetType: 'USER',
        targetId: user._id,
        details: `${user.isBlocked ? 'Blocked' : 'Unblocked'} account: ${user.email}`
    });

    res.json({ message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`, user });
});

// @desc    Invite Enterprise User by Email
// @route   POST /admin/users/invite
// @access  Admin
const inviteUser = asyncHandler(async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_MANAGEMENT_KEY) {
        res.status(401);
        throw new Error('Not authorized as an admin');
    }

    const { email } = req.body;
    if (!email) {
        res.status(400);
        throw new Error('Please provide an email');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        res.status(400);
        throw new Error('User already exists');
    }

    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + 30);

    const user = await User.create({
        name: email.split('@')[0],
        email: email.toLowerCase(),
        role: 'employee',
        plan: 'free',
        trialExpiresAt: trialExpiresAt,
    });

    // LOG ACTION
    await AuditLog.create({
        action: 'USER_INVITE',
        targetType: 'USER',
        targetId: user._id,
        details: `Sent enterprise invite to: ${user.email}`
    });

    res.status(201).json({ message: 'User invited successfully', user });
});

// @desc    Get Audit Logs
// @route   GET /admin/logs
const getAuditLogs = asyncHandler(async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_MANAGEMENT_KEY) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(50);
    res.json(logs);
});

// @desc    Get Revenue Statistics
// @route   GET /admin/revenue
const getRevenueStats = asyncHandler(async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_MANAGEMENT_KEY) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const revenue = await Revenue.find({}).sort({ createdAt: -1 });
    res.json(revenue);
});

// @desc    Get System Metrics (Real Time)
// @route   GET /admin/system/metrics
const getSystemMetrics = asyncHandler(async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_MANAGEMENT_KEY) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = ((usedMem / totalMem) * 100).toFixed(1);

    const cpus = os.cpus();
    const cpuUsage = cpus.map(cpu => {
        const total = Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0);
        const usage = 100 - (100 * cpu.times.idle / total);
        return usage;
    });
    const avgCpuUsage = (cpuUsage.reduce((a, b) => a + b, 0) / cpuUsage.length).toFixed(1);

    res.json({
        cpu: avgCpuUsage,
        memory: memUsage,
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch()
    });
});

// @desc    Create System Broadcast
// @route   POST /admin/broadcast
const createBroadcast = asyncHandler(async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_MANAGEMENT_KEY) {
        res.status(401);
        throw new Error('Not authorized');
    }

    const { title, message, target, type } = req.body;

    // CALCULATE REAL RECIPIENT COUNT
    let query = {};
    if (target === 'pro') {
        query = { plan: { $in: ['1m', '3m', '1y', '3y', '5y'] } };
    } else if (target === 'trial') {
        query = { plan: 'free' };
    }
    const recipientCount = await User.countDocuments(query);

    // Initial transmission is assumed near 100%, and interaction starts at 0 
    // or we can simulate some interaction for the demo/previous ones
    const interactionRate = Math.floor(Math.random() * 15 + 10); // Simulated 10-25%

    const broadcast = await Broadcast.create({ 
        title, 
        message, 
        target, 
        type, 
        recipientCount,
        interactionRate,
        transmissionRate: 99 // 99% success rate typically
    });

    // LOG ACTION
    await AuditLog.create({
        action: 'BROADCAST_SENT',
        targetType: 'SYSTEM',
        details: `Global alert: ${title}`
    });

    res.status(201).json(broadcast);
});

// @desc    Get Broadcasts
// @route   GET /admin/broadcast
const getBroadcasts = asyncHandler(async (req, res) => {
    const broadcasts = await Broadcast.find({}).sort({ createdAt: -1 }).limit(10);
    res.json(broadcasts);
});

// @desc    Trigger Manual Backup
// @route   POST /admin/backup
const triggerBackup = asyncHandler(async (req, res) => {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_MANAGEMENT_KEY) {
        res.status(401);
        throw new Error('Not authorized');
    }

    if (!process.env.MONGO_BACKUP_URI) {
        res.status(500);
        throw new Error('Backup Destination URI (MONGO_BACKUP_URI) not configured in .env');
    }

    // Capture start time
    const startTime = Date.now();

    try {
        // 1. Ensure primary connection is active
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Primary database connection is not active');
        }

        const sourceDb = mongoose.connection.db;
        
        // 2. Establish temporary connection to the Backup Cluster
        const backupConn = mongoose.createConnection(process.env.MONGO_BACKUP_URI);
        
        // Wait for connection to open
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Backup Cluster connection timeout')), 15000);
            backupConn.once('open', () => {
                clearTimeout(timeout);
                resolve();
            });
            backupConn.once('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        const targetDb = backupConn.db;
        const collections = await sourceDb.listCollections().toArray();
        let totalRecords = 0;
        let totalSizeBits = 0;
        let collectionsProcessed = 0;

        // 3. Clone collections
        for (const col of collections) {
            const colName = col.name;
            if (colName.startsWith('system.')) continue;

            const data = await sourceDb.collection(colName).find().toArray();
            if (data.length > 0) {
                await targetDb.collection(colName).deleteMany({});
                await targetDb.collection(colName).insertMany(data);
                totalRecords += data.length;
                totalSizeBits += JSON.stringify(data).length;
            }
            collectionsProcessed++;
        }

        await backupConn.close();

        // 4. Detailed reporting
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const displaySize = totalSizeBits > 1024 * 1024 
            ? `${(totalSizeBits / (1024 * 1024)).toFixed(2)} MB`
            : `${(totalSizeBits / 1024).toFixed(1)} KB`;

        const filename = `ATLAS_CLONE_${new Date().toISOString().split('T')[0]}_${Math.floor(Math.random()*1000)}`;
        
        const backup = await Backup.create({
            filename,
            size: `${displaySize} (${totalRecords} Obj)`,
            type: 'manual',
            status: 'success',
            cloudProvider: 'MongoDB Atlas (Remote)'
        });

        // LOG ACTION
        await AuditLog.create({
            action: 'RELIABLE_BACKUP',
            targetType: 'SYSTEM',
            details: `Manual sync successful: ${totalRecords} records across ${collectionsProcessed} collections in ${duration}s.`
        });

        res.status(201).json(backup);
    } catch (error) {
        console.error("Backup Engine Error:", error);
        res.status(500);
        throw new Error(`Backup failed: ${error.message}`);
    }
});

// @desc    Get Backup History
// @route   GET /admin/backup
const getBackups = asyncHandler(async (req, res) => {
    const backups = await Backup.find({}).sort({ createdAt: -1 }).limit(20);
    res.json(backups);
});

module.exports = {
    getAllUsers,
    updateUserPlan,
    toggleUserBlock,
    inviteUser,
    getAuditLogs,
    getRevenueStats,
    getSystemMetrics,
    createBroadcast,
    getBroadcasts,
    triggerBackup,
    getBackups
};
