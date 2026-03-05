require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/userModel');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const users = await User.find({}, 'name email role createdAt');
    console.log('\n=== ALL USERS IN DATABASE ===\n');
    console.log('No | Name                  | Email                         | Role     | Created');
    console.log('---|----------------------|-------------------------------|----------|--------');
    users.forEach((u, i) => {
        const num = String(i + 1).padEnd(2);
        const name = (u.name || '').padEnd(20);
        const email = (u.email || '').padEnd(30);
        const role = (u.role || '').padEnd(8);
        const created = u.createdAt ? u.createdAt.toISOString().split('T')[0] : 'N/A';
        console.log(`${num} | ${name} | ${email} | ${role} | ${created}`);
    });
    console.log(`\nTotal: ${users.length} users`);
    process.exit(0);
}).catch(e => {
    console.error(e.message);
    process.exit(1);
});
