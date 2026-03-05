const multer = require('multer');
const path = require('path');
const fs = require('fs');

function asegurarDirectorio(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// --- Almacenamiento para PDFs ---
const dirPDFs = path.join(__dirname, '../../uploads');
asegurarDirectorio(dirPDFs);

const almacenamientoPDF = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dirPDFs),
  filename: (req, file, cb) => {
    const marcaTiempo = Date.now();
    const ext = path.extname(file.originalname);
    const nombre = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    cb(null, `${nombre}_${marcaTiempo}${ext}`);
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
  storage: almacenamientoPDF,
  fileFilter: filtroPDF,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// --- Almacenamiento para fotos de siniestros ---
const dirFotos = path.join(__dirname, '../../uploads/siniestros');
asegurarDirectorio(dirFotos);

const almacenamientoFotos = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dirFotos),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `foto_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
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
  storage: almacenamientoFotos,
  fileFilter: filtroImagenes,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB por foto
});

// --- Almacenamiento en memoria (para análisis de PDF con IA, sin escribir en disco) ---
const uploadMemoria = multer({
  storage: multer.memoryStorage(),
  fileFilter: filtroPDF,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo en memoria
});

module.exports = { upload, uploadFotos, uploadMemoria };
