const cloudinary = require('cloudinary').v2;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const filePath = 'd:\\Zippy\\Kwiq Bill Files\\Kwiq_Bill_demo\\Zilling-mobile\\assets\\kwiq.jpg';

cloudinary.uploader.upload(filePath, {
  folder: 'branding',
  public_id: 'kwiq_bill_logo',
  overwrite: true,
  resource_type: 'image'
}, (error, result) => {
  if (error) {
    console.error('Upload failed:', error);
  } else {
    console.log('---LOGO_URL_START---');
    console.log(result.secure_url);
    console.log('---LOGO_URL_END---');
  }
});
