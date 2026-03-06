const cloudinary = require('cloudinary').v2;

// Configuración explícita con variables individuales (ignora CLOUDINARY_URL)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('Cloudinary config — cloud_name:', process.env.CLOUDINARY_CLOUD_NAME, '| api_key:', process.env.CLOUDINARY_API_KEY, '| secret set:', !!process.env.CLOUDINARY_API_SECRET);

module.exports = cloudinary;
