const mongoose = require('mongoose');
require('dotenv').config();
const Settings = require('./src/models/settingsModel');

const verify = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const latest = await Settings.findOne().sort({ updatedAt: -1 });
        if (latest) {
            console.log('USER DETAILS IN SETTINGS:');
            console.log(JSON.stringify(latest.user, null, 2));
            console.log('USER EMAIL (TOP LEVEL):', latest.userEmail);
            console.log('USER ID:', latest.userId);
        } else {
            console.log('No settings found');
        }
        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
};

verify();
