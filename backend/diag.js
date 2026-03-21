const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/userModel');
const SecurityBackup = require('./src/models/SecurityBackup');

async function check() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://kwiqbill-db:f9m8h4y3@billing-cloud.00lfdzf.mongodb.net/test');
    const user = await User.findOne({ email: 'sanjaipandian.as@gmail.com' });
    console.log('USER:', user ? { id: user._id, email: user.email } : 'NOT FOUND');
    if (user) {
        console.log(`\n>>> ANALYZING USER: ${user.email} (ID: ${user._id})`);
        const backups = await SecurityBackup.find({ user: user._id }).sort({ createdAt: -1 });
        console.log('TOTAL BACKUPS FOUND FOR THIS USER:', backups.length);
        backups.forEach((b, i) => {
            console.log(`  RECORD #${i + 1}: [BackupID: ${b._id}] [LinkedToUserID: ${b.user}]`);
            console.log(`    - hasHash: ${!!b.otpHash} | snippet: ${b.otpHash?.substring(0, 10)}`);
            console.log(`    - expires: ${b.otpExpiresAt} | expired: ${b.otpExpiresAt < new Date()}`);
        });
    }
    process.exit(0);
}
check();
