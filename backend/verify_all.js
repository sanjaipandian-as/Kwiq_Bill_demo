const mongoose = require('mongoose');
require('dotenv').config();
const Settings = require('./src/models/settingsModel');
const User = require('./src/models/userModel');

const verify = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log('--- ALL USERS ---');
        const users = await User.find();
        users.forEach(u => {
            console.log(`User: ${u.email}, Name: ${u.name}, GoogleId: ${u.googleId}, ID: ${u._id}`);
        });

        console.log('\n--- ALL SETTINGS (COMPANY PROFILES) ---');
        const allSettings = await Settings.find();
        allSettings.forEach(s => {
            console.log(`Settings for UserID: ${s.userId}, userEmail: ${s.userEmail}`);
            console.log(`  User Details: ${JSON.stringify(s.user)}`);
            console.log(`  Store Name: ${s.store?.name}`);
            console.log('-----------------------------------');
        });

        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
};

verify();
