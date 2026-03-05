import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ abierto, onCerrar, titulo, children, ancho = 'max-w-lg' }) {
  useEffect(() => {
    if (abierto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
    >
      {/* Fondo oscuro */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCerrar} />

      {/* Panel del modal */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${ancho} max-h-[90vh] flex flex-col`}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
