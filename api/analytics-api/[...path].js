export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // En Vercel, el parámetro de una ruta catch-all puede no llegar
    // como req.query.path según el runtime. Por eso obtenemos el path
    // directamente desde req.url.
    const incoming = new URL(req.url || '/', 'https://miruta-analytics.vercel.app');
    const prefix = '/api/analytics-api';
    let apiPath = incoming.pathname.startsWith(prefix)
      ? incoming.pathname.slice(prefix.length)
      : '';

    if (!apiPath || apiPath === '/') {
      apiPath = '/Stats';
    }

    const target = `https://analytics.trujillo.trufi.dev/analytics-api${apiPath}${incoming.search}`;
    console.log('Analytics proxy:', req.method, incoming.pathname, '->', target);

    const headers = {};
    if (req.headers.accept) headers.accept = req.headers.accept;
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

    let body;
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (req.body !== undefined) {
        body = JSON.stringify(req.body);
        headers['content-type'] = headers['content-type'] || 'application/json';
      }
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body
    });

    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const text = await upstream.text();
    return res.status(upstream.status).send(text);
  } catch (error) {
    console.error('Analytics proxy error:', error);
    return res.status(502).json({
      error: 'No se pudo consultar la Analytics API',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
