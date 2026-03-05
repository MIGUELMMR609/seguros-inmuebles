import { useState, useRef } from 'react';
import { FileText, Sparkles, SkipForward, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import { analizarPdfApi } from '../api/index.js';

export default function AnalizadorPDF({ onDatosExtraidos, onOmitir }) {
  const [paso, setPaso] = useState('pregunta'); // 'pregunta' | 'subiendo' | 'analizando' | 'error'
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  async function handleArchivo(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    if (archivo.type !== 'application/pdf') {
      setError('Solo se aceptan archivos PDF');
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      setError('El archivo no puede superar 10 MB');
      return;
    }

    setError('');
    setPaso('analizando');

    try {
      const res = await analizarPdfApi(archivo);
      onDatosExtraidos(res.data.datos);
    } catch (err) {
      const mensajeError = err.response?.data?.error || err.message || 'Error al analizar el PDF';
      setError(mensajeError);
      setPaso('error');
    }
  }

  if (paso === 'pregunta') {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
          <FileText size={32} className="text-[#1e3a5f]" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          ¿Tienes el PDF del documento?
        </h3>
        <p className="text-sm text-gray-500 mb-8 max-w-xs">
          Si tienes el PDF de la póliza o contrato, la IA puede extraer automáticamente los datos del formulario.
        </p>
        <div className="flex gap-3 w-full max-w-sm">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-primario flex-1 justify-center"
          >
            <Sparkles size={16} />
            Sí, analizar PDF
          </button>
          <button
            type="button"
            onClick={onOmitir}
            className="btn-secundario flex-1 justify-center"
          >
            <SkipForward size={16} />
            Omitir
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleArchivo}
          className="hidden"
        />
      </div>
    );
  }

  if (paso === 'analizando') {
    return (
      <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Analizando el PDF...</h3>
        <p className="text-sm text-gray-500">La IA está leyendo el documento. Esto puede tardar unos segundos.</p>
      </div>
    );
  }

  if (paso === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No se pudo analizar el PDF</h3>
        <p className="text-sm text-red-600 mb-6">{error}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setPaso('pregunta'); setError(''); inputRef.current && (inputRef.current.value = ''); }}
            className="btn-secundario"
          >
            Intentar de nuevo
          </button>
          <button type="button" onClick={onOmitir} className="btn-primario">
            Continuar sin PDF
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleArchivo}
          className="hidden"
        />
      </div>
    );
  }

  return null;
}
