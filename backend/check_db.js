const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    email: { type: String, required: true, unique: true },
    trialExpiresAt: Date,
    plan: String,
    planExpiresAt: Date,
});
const User = mongoose.model('User', userSchema);

mongoose.connect('mongodb+srv://kaviraja:kaviraja6002@billingsoftware.00lfdzf.mongodb.net/BillingSoftware?retryWrites=true&w=majority')
    .then(async () => {
        const user = await User.findOne({ email: 'sanjaipandian.as@gmail.com' });
        console.log("DB USER:", user);
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
