const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();
const Settings = require('./src/models/settingsModel');
const User = require('./src/models/userModel');

const verify = async () => {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    try {
        await mongoose.connect(process.env.MONGO_URI);

        log('--- ALL USERS ---');
        const users = await User.find();
        users.forEach(u => {
            log(`User: ${u.email}, Name: ${u.name}, GoogleId: ${u.googleId}, ID: ${u._id}`);
        });

        log('\n--- ALL SETTINGS (COMPANY PROFILES) ---');
        const allSettings = await Settings.find();
        allSettings.forEach(s => {
            log(`Settings for UserID: ${s.userId}, userEmail: ${s.userEmail}`);
            log(`  User Details: ${JSON.stringify(s.user, null, 2)}`);
            log(`  Store Name: ${s.store?.name}`);
            log('-----------------------------------');
        });

        fs.writeFileSync('all_data_utf8.txt', output, 'utf8');
        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
};

verify();
