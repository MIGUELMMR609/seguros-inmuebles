const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// --- Almacenamiento en memoria para PDFs (compresión manual antes de Cloudinary) ---
const filtroPDF = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.mimetype === 'application/octet-stream' || file.originalname?.toLowerCase().endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF'), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: filtroPDF,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// --- Almacenamiento Cloudinary para fotos de siniestros ---
const storageFotos = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'siniestros',
    resource_type: 'image',
  }),
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

// --- Almacenamiento en memoria (legacy) ---
const uploadMemoria = multer({
  storage: multer.memoryStorage(),
  fileFilter: filtroPDF,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// --- Almacenamiento en memoria para recibos bancarios (PDF o imagen) ---
const filtroReciboPDFoImagen = (req, file, cb) => {
  const esPDF = file.mimetype === 'application/pdf'
    || file.mimetype === 'application/octet-stream'
    || file.originalname?.toLowerCase().endsWith('.pdf');
  const esImagen = file.mimetype.startsWith('image/');
  if (esPDF || esImagen) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten PDF o imágenes'), false);
  }
};

const uploadRecibo = multer({
  storage: multer.memoryStorage(),
  fileFilter: filtroReciboPDFoImagen,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

module.exports = { upload, uploadFotos, uploadMemoria, uploadRecibo };
