export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const incoming = new URL(req.url || '/', 'https://miruta-analytics.vercel.app');
    const prefix = '/api/analytics-api';
    let apiPath = incoming.pathname.startsWith(prefix)
      ? incoming.pathname.slice(prefix.length)
      : '';

    if (!apiPath || apiPath === '/') apiPath = '/Stats';

    const target = `https://analytics.trujillo.trufi.dev/analytics-api${apiPath}${incoming.search}`;
    console.log('Analytics proxy:', req.method, incoming.pathname, '->', target);

    const headers = {};
    if (req.headers.accept) headers.accept = req.headers.accept;
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

    let body;
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (typeof req.body === 'string') body = req.body;
      else if (req.body !== undefined) {
        body = JSON.stringify(req.body);
        headers['content-type'] = headers['content-type'] || 'application/json';
      }
    }

    const upstream = await fetch(target, { method: req.method, headers, body });
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    let text = await upstream.text();

    // Normalización exclusiva para el dashboard:
    // 1) OTP entrega la empresa en leg.route.agency; el dashboard histórico
    //    busca leg.agency. Copiamos la referencia para que las empresas
    //    puedan contabilizarse correctamente.
    // 2) Los timestamps de OTP están en UTC. El dashboard debe mostrar
    //    la hora local de Trujillo (America/Lima = UTC-5).
    if (upstream.ok && req.method === 'GET' && apiPath.toLowerCase() === '/logs') {
      try {
        const payload = JSON.parse(text);
        const logs = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload?.results)
                ? payload.results
                : null;

        if (logs) {
          const localOffsetMs = 5 * 60 * 60 * 1000;

          for (const log of logs) {
            if (!log || typeof log.responseBody !== 'string') continue;

            try {
              const response = JSON.parse(log.responseBody);
              const itineraries = response?.data?.plan?.itineraries;
              if (!Array.isArray(itineraries)) continue;

              for (const itinerary of itineraries) {
                if (Number.isFinite(Number(itinerary.startTime))) {
                  itinerary.startTime = Number(itinerary.startTime) - localOffsetMs;
                }

                if (!Array.isArray(itinerary.legs)) continue;
                for (const leg of itinerary.legs) {
                  if (leg?.route?.agency && !leg.agency) {
                    leg.agency = leg.route.agency;
                  }
                }
              }

              log.responseBody = JSON.stringify(response);
            } catch (_) {
              // Si un registro tiene responseBody no JSON, se conserva intacto.
            }
          }

          text = JSON.stringify(payload);
        }
      } catch (_) {
        // Si la respuesta no es JSON, se devuelve sin modificar.
      }
    }

    return res.status(upstream.status).send(text);
  } catch (error) {
    console.error('Analytics proxy error:', error);
    return res.status(502).json({
      error: 'No se pudo consultar la Analytics API',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
