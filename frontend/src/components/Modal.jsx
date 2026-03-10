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
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
    >
      {/* Fondo oscuro */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm hidden sm:block" onClick={onCerrar} />

      {/* Panel: pantalla completa en móvil, centrado en desktop */}
      <div
        className={`relative z-10 bg-white flex flex-col
          fixed inset-0 sm:static sm:inset-auto
          sm:${ancho} sm:rounded-2xl sm:shadow-2xl sm:max-h-[90vh] sm:w-full`}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 safe-top flex-shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate pr-2">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100 touch-target flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 safe-bottom">{children}</div>
      </div>
    </div>
  );
}
