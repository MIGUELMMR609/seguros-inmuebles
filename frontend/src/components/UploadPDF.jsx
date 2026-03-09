import { useState, useRef } from 'react';
import { Upload, FileText, X, ExternalLink } from 'lucide-react';
import { subirDocumentoApi } from '../api/index.js';

const API_BASE = import.meta.env.VITE_API_URL || '';
function urlDoc(url) {
  if (!url) return url;
  return url.startsWith('/') ? API_BASE + url : url;
}

export default function UploadPDF({ urlActual, onSubida }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const inputRef = useRef(null);

  async function handleSeleccion(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;

    if (archivo.type !== 'application/pdf') {
      setError('Solo se permiten archivos PDF');
      return;
    }

    if (archivo.size > 50 * 1024 * 1024) {
      setError('El archivo no puede superar los 50 MB');
      return;
    }

    setError('');
    setSubiendo(true);

    try {
      const respuesta = await subirDocumentoApi(archivo);
      setNombreArchivo(archivo.name);
      onSubida(respuesta.data.url);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir el documento');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function limpiar() {
    setNombreArchivo('');
    onSubida('');
  }

  const urlMostrar = nombreArchivo ? null : urlActual;
  const nombreMostrar = nombreArchivo || (urlActual ? urlActual.split('/').pop() : '');

  return (
    <div>
      {nombreMostrar ? (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <FileText size={16} className="text-blue-600 flex-shrink-0" />
          <span className="text-sm text-blue-700 flex-1 truncate">{nombreMostrar}</span>
          {urlMostrar && (
            <a
              href={urlDoc(urlMostrar)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 flex-shrink-0"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button
            type="button"
            onClick={limpiar}
            className="text-blue-400 hover:text-red-500 flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="flex items-center gap-2 w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors disabled:opacity-50"
        >
          {subiendo ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              <span>Subiendo documento...</span>
            </>
          ) : (
            <>
              <Upload size={16} />
              <span>Subir documento PDF (máx. 50 MB)</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={handleSeleccion}
        className="hidden"
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
