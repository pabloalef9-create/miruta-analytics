export default async function handler(req, res) {
  // CORS: GitHub Pages will call this Vercel Function from the browser.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const rawPath = req.query?.path;
    const segments = Array.isArray(rawPath) ? rawPath : (rawPath ? [rawPath] : []);
    const apiPath = segments.map(encodeURIComponent).join('/');

    const incoming = new URL(req.url, 'http://localhost');
    const target = `https://analytics.trujillo.trufi.dev/analytics-api/${apiPath}${incoming.search}`;

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
