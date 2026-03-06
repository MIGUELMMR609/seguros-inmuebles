const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// --- Almacenamiento Cloudinary para PDFs ---
const storagePDF = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'polizas-seguros',
    resource_type: 'raw',
    allowed_formats: ['pdf'],
  },
});

const filtroPDF = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF'), false);
  }
};

const upload = multer({
  storage: storagePDF,
  fileFilter: filtroPDF,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// --- Almacenamiento Cloudinary para fotos de siniestros ---
const storageFotos = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'siniestros',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  },
});

const filtroImagenes = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes'), false);
  }
};

const uploadFotos = multer({
  storage: storageFotos,
  fileFilter: filtroImagenes,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB por foto
});

// --- Almacenamiento en memoria (legacy, por si se necesita) ---
const uploadMemoria = multer({
  storage: multer.memoryStorage(),
  fileFilter: filtroPDF,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = { upload, uploadFotos, uploadMemoria };
