const { PDFDocument } = require('pdf-lib');

const MAX_BYTES_PDF = 5 * 1024 * 1024; // 5 MB límite Anthropic
const MAX_PAGINAS_PDF = 10;

async function reducirPdf(buffer) {
  if (buffer.length <= MAX_BYTES_PDF) return buffer;
  try {
    const pdfOrig = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const total = pdfOrig.getPageCount();
    const paginas = Math.min(total, MAX_PAGINAS_PDF);
    const pdfNuevo = await PDFDocument.create();
    const copiadas = await pdfNuevo.copyPages(pdfOrig, Array.from({ length: paginas }, (_, i) => i));
    copiadas.forEach((p) => pdfNuevo.addPage(p));
    const bytes = await pdfNuevo.save();
    console.log(`PDF reducido: ${total} → ${paginas} páginas (${buffer.length} → ${bytes.length} bytes)`);
    return Buffer.from(bytes);
  } catch (err) {
    console.warn('No se pudo reducir el PDF, se envía truncado:', err.message);
    return buffer.slice(0, MAX_BYTES_PDF);
  }
}

module.exports = { reducirPdf, MAX_BYTES_PDF, MAX_PAGINAS_PDF };
