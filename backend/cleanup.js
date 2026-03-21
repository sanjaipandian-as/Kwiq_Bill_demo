const mongoose = require('mongoose');
require('dotenv').config();
const SecurityBackup = require('./src/models/SecurityBackup');

async function cleanup() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://kwiqbill-db:f9m8h4y3@billing-cloud.00lfdzf.mongodb.net/test');
    
    // 1. Group backups by user to find duplicates
    const duplicates = await SecurityBackup.aggregate([
        { $group: { _id: "$user", count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } }
    ]);
    
    console.log(`Found ${duplicates.length} users with duplicate backups.`);
    
    for (const group of duplicates) {
        const userId = group._id;
        const all = await SecurityBackup.find({ user: userId }).sort({ createdAt: -1 });
        
        // Keep the one with most data or latest
        let best = all[0];
        for (const b of all) {
            // Priority: Record with Master Key > Record with OTP > Newest
            if (b.encryptedMasterKeyBackup && !best.encryptedMasterKeyBackup) {
                best = b;
            } else if (b.otpHash && !best.otpHash && !best.encryptedMasterKeyBackup) {
                best = b;
            }
        }
        
        const toDelete = group.ids.filter(id => id.toString() !== best._id.toString());
        console.log(`User ${userId}: Keeping ${best._id}, deleting ${toDelete.length} duplicates.`);
        
        await SecurityBackup.deleteMany({ _id: { $in: toDelete } });
    }
    
    // Also try to ensure the index is built
    try {
        await SecurityBackup.createIndexes();
        console.log('Unique index on user field ensured.');
    } catch (e) {
        console.error('Failed to create unique index (maybe remaining duplicates?):', e.message);
    }
    
    process.exit(0);
}
cleanup();
