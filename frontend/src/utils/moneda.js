/**
 * Formatea un valor numérico (almacenado como string JS con punto decimal)
 * al formato español con separador de miles (punto) y decimal (coma).
 *
 * Ejemplos:
 *   formatearMiles("1000")       → "1.000"
 *   formatearMiles("1000000.50") → "1.000.000,50"
 *   formatearMiles("")           → ""
 */
export function formatearMiles(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  const str = String(valor);
  const [entero, decimal] = str.split('.');
  const enteroLimpio = entero.replace(/\D/g, '');
  if (!enteroLimpio && decimal === undefined) return str;
  const conPuntos = enteroLimpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decimal !== undefined) return conPuntos + ',' + decimal;
  return conPuntos;
}

/**
 * Limpia un valor con formato español (puntos de miles, coma decimal)
 * y devuelve un string numérico JS listo para parseFloat().
 *
 * Ejemplos:
 *   limpiarMiles("1.000")        → "1000"
 *   limpiarMiles("1.000.000,50") → "1000000.50"
 *   limpiarMiles("")             → ""
 */
export function limpiarMiles(texto) {
  if (!texto) return '';
  const limpio = texto.replace(/\./g, '').replace(',', '.');
  return limpio;
}
