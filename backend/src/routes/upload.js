const express = require('express');
const { verificarToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();
router.use(verificarToken);

// POST /api/upload - Subir un PDF
router.post('/', upload.single('documento'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    res.status(201).json({
      mensaje: 'Documento subido correctamente',
      url: req.file.path,
      nombreOriginal: req.file.originalname,
      tamano: req.file.size,
    });
  } catch (error) {
    console.error('Error al subir documento:', error);
    res.status(500).json({ error: 'Error al subir el documento' });
  }
});

// Manejador de errores de multer/Cloudinary
router.use((err, req, res, next) => {
  console.error('Error upload [message]:', err?.message);
  console.error('Error upload [http_code]:', err?.http_code);
  console.error('Error upload [JSON]:', JSON.stringify(err, Object.getOwnPropertyNames(err ?? {})));
  if (err.message === 'Solo se permiten archivos PDF') {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'El archivo supera el tamaño máximo de 10 MB' });
  }
  res.status(500).json({ error: err?.message || 'Error al subir el archivo' });
});

module.exports = router;
