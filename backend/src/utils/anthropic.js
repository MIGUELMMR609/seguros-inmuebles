const ESPERA_429_MS = 60_000;

/**
 * Llama a la API de Anthropic (POST /v1/messages) con reintento automático
 * en caso de 429 (rate limit): espera 60 s y reintenta una vez.
 *
 * @param {object} opciones - Opciones de fetch (method, headers, body, signal…)
 * @returns {Promise<Response>}
 */
async function llamarAnthropicApi(opciones) {
  const respuesta = await fetch('https://api.anthropic.com/v1/messages', opciones);

  if (respuesta.status !== 429) return respuesta;

  const signal = opciones.signal;

  if (signal?.aborted) {
    const err = new Error('AbortError');
    err.name = 'AbortError';
    throw err;
  }

  console.warn(`Anthropic 429 (rate limit) — esperando ${ESPERA_429_MS / 1000}s antes de reintentar...`);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ESPERA_429_MS);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        const err = new Error('AbortError');
        err.name = 'AbortError';
        reject(err);
      }, { once: true });
    }
  });

  if (signal?.aborted) {
    const err = new Error('AbortError');
    err.name = 'AbortError';
    throw err;
  }

  console.warn('Reintentando llamada a Anthropic tras espera por rate limit...');
  return fetch('https://api.anthropic.com/v1/messages', opciones);
}

module.exports = { llamarAnthropicApi };
