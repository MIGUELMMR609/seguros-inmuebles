import { useEffect, useState } from 'react';
import { Database, Download, HardDrive, Trash2 } from 'lucide-react';
import { obtenerBackupsApi, crearBackupApi, descargarBackupApi, eliminarBackupApi } from '../api/index.js';

export default function Backup() {
  const [backups, setBackups] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [haciendoBackup, setHaciendoBackup] = useState(false);
  const [descargando, setDescargando] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  async function cargar() {
    try {
      const res = await obtenerBackupsApi();
      setBackups(res.data);
    } catch {
      setError('Error al cargar las copias de seguridad');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function handleBackup() {
    setHaciendoBackup(true);
    setError('');
    setExito('');
    try {
      const res = await crearBackupApi();
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : 'backup.json';
      a.click();
      window.URL.revokeObjectURL(url);
      setExito('Copia de seguridad creada y descargada correctamente.');
      await cargar();
    } catch {
      setError('Error al crear la copia de seguridad');
    } finally {
      setHaciendoBackup(false);
    }
  }

  async function handleEliminar(backup) {
    if (!window.confirm(`¿Eliminar la copia del ${new Date(backup.fecha).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}?`)) return;
    setEliminando(backup.id);
    setError('');
    try {
      await eliminarBackupApi(backup.id);
      setExito('Copia eliminada correctamente.');
      await cargar();
    } catch {
      setError('Error al eliminar la copia');
    } finally {
      setEliminando(null);
    }
  }

  async function handleDescargar(backup) {
    setDescargando(backup.id);
    setError('');
    try {
      const res = await descargarBackupApi(backup.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.nombre_archivo;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Error al descargar la copia');
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database size={22} className="text-[#1e3a5f]" />
            Copias de seguridad
          </h1>
          <p className="text-gray-500 text-sm mt-1">Backup automático cada lunes a las 8:00 AM · Se conservan los últimos 10</p>
          {backups.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Último backup en Render:{' '}
              <span className="font-medium text-gray-600">
                {new Date(backups[0].fecha).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={handleBackup}
          disabled={haciendoBackup}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#152740] text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-60 transition-colors"
        >
          {haciendoBackup
            ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Creando...</>
            : <><HardDrive size={15} /> Hacer copia ahora</>}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}
      {exito && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">{exito}</div>
      )}

      <div className="tarjeta">
        {cargando ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" />
          </div>
        ) : backups.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No hay copias guardadas. Pulsa "Hacer copia ahora" para crear la primera.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {backups.map((b, i) => {
              const conteo = b.conteo_registros || {};
              const total = Object.values(conteo).reduce((s, v) => s + (v || 0), 0);
              return (
                <div key={b.id} className={`flex items-center justify-between py-3 ${i === 0 ? '' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {new Date(b.fecha).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}
                      {i === 0 && (
                        <span className="ml-2 text-[11px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">Última</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {total} registros totales
                      {conteo.inmuebles != null && (
                        <> · {conteo.inmuebles} inmuebles · {conteo.polizas} pólizas · {conteo.inquilinos} inquilinos · {conteo.siniestros} siniestros</>
                      )}
                      {b.tamanyo ? ` · ${Math.round(b.tamanyo / 1024)} KB` : ''}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex items-center gap-3">
                    <button
                      onClick={() => handleDescargar(b)}
                      disabled={descargando === b.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-[#1e3a5f] hover:underline disabled:opacity-50"
                    >
                      {descargando === b.id
                        ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#1e3a5f]" />
                        : <Download size={14} />}
                      Descargar
                    </button>
                    <button
                      onClick={() => handleEliminar(b)}
                      disabled={eliminando === b.id}
                      className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600 disabled:opacity-50"
                      title="Eliminar esta copia"
                    >
                      {eliminando === b.id
                        ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-400" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
