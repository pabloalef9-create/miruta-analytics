export default async function handler(req, res) {
  try {
    const upstream = await fetch('https://analytics.trujillo.trufi.dev/analytics-api/health');
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    const text = await upstream.text();
    return res.status(upstream.status).send(text);
  } catch (error) {
    return res.status(502).json({
      error: 'No se pudo consultar la Analytics API',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
