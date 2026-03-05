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

    const urlDocumento = `/uploads/${req.file.filename}`;

    res.status(201).json({
      mensaje: 'Documento subido correctamente',
      url: urlDocumento,
      nombreOriginal: req.file.originalname,
      tamano: req.file.size,
    });
  } catch (error) {
    console.error('Error al subir documento:', error);
    res.status(500).json({ error: 'Error al subir el documento' });
  }
});

// Manejador de errores de multer
router.use((err, req, res, next) => {
  if (err.message === 'Solo se permiten archivos PDF') {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'El archivo supera el tamaño máximo de 10 MB' });
  }
  next(err);
});

module.exports = router;
