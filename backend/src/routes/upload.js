const express = require('express');
const { PDFDocument } = require('pdf-lib');
const { verificarToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');

const router = express.Router();
router.use(verificarToken);

const MAX_BYTES_CLOUDINARY = 9.5 * 1024 * 1024; // 9,5 MB (plan gratuito Cloudinary ≈ 10 MB)
const MAX_PAGINAS_CLOUDINARY = 10;

// Reduce el PDF a las primeras MAX_PAGINAS páginas si supera el límite de Cloudinary
async function reducirParaCloudinary(buffer) {
  if (buffer.length <= MAX_BYTES_CLOUDINARY) return buffer;
  try {
    const pdfOrig = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const total = pdfOrig.getPageCount();
    if (total <= MAX_PAGINAS_CLOUDINARY) return buffer; // no se puede reducir por páginas
    const pdfNuevo = await PDFDocument.create();
    const indices = Array.from({ length: MAX_PAGINAS_CLOUDINARY }, (_, i) => i);
    const paginas = await pdfNuevo.copyPages(pdfOrig, indices);
    paginas.forEach((p) => pdfNuevo.addPage(p));
    const bytes = await pdfNuevo.save();
    console.log(`upload: PDF reducido ${total} → ${MAX_PAGINAS_CLOUDINARY} páginas (${buffer.length} → ${bytes.length} bytes)`);
    return Buffer.from(bytes);
  } catch (err) {
    console.warn('upload: no se pudo reducir PDF para Cloudinary:', err.message);
    return buffer;
  }
}

function subirACloudinary(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: 'polizas-seguros', resource_type: 'raw', type: 'upload', access_mode: 'public', format: 'pdf' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    ).end(buffer);
  });
}

// POST /api/upload - Subir un PDF
router.post('/', upload.single('documento'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const bufferReducido = await reducirParaCloudinary(req.file.buffer);
    const url = await subirACloudinary(bufferReducido);

    res.status(201).json({
      mensaje: 'Documento subido correctamente',
      url,
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
    return res.status(400).json({ error: 'El archivo supera el tamaño máximo de 50 MB' });
  }
  res.status(500).json({ error: err?.message || 'Error al subir el archivo' });
});

module.exports = router;
module.exports.subirACloudinary = subirACloudinary;
