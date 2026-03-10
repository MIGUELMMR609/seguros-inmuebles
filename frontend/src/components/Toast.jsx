import { useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const CONFIGURACION = {
  success: { Icono: CheckCircle, clases: 'bg-green-50 border-green-300 text-green-800' },
  warning: { Icono: AlertTriangle, clases: 'bg-orange-50 border-orange-300 text-orange-800' },
  error: { Icono: XCircle, clases: 'bg-red-50 border-red-300 text-red-800' },
  info: { Icono: Info, clases: 'bg-blue-50 border-blue-300 text-blue-800' },
};

export default function Toast({ mensaje, tipo = 'info', onCerrar }) {
  const { Icono, clases } = CONFIGURACION[tipo] || CONFIGURACION.info;

  useEffect(() => {
    const timer = setTimeout(onCerrar, 5000);
    return () => clearTimeout(timer);
  }, [onCerrar]);

  return (
    <div
      className={`fixed z-50 flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl animate-in ${clases}
        bottom-4 left-4 right-4 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-sm`}
    >
      <Icono size={18} className="flex-shrink-0 mt-0.5" />
      <p className="text-sm flex-1 leading-snug">{mensaje}</p>
      <button
        onClick={onCerrar}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity ml-1 p-1 touch-target"
      >
        <X size={16} />
      </button>
    </div>
  );
}
