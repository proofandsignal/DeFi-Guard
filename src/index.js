import { evaluatePosition } from './core/guard.js';

const VERSION = '0.1.0';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok:true, service:'defi-guard', version:VERSION });
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/meta') {
      return json({
        service:'DeFi Guard',
        version:VERSION,
        mode:'read-only',
        architecture:'Position Snapshot -> Guard Rule Engine -> Explainable Alert Event',
        alertStates:['OK','WATCH','WARNING','CRITICAL','VERIFY'],
        execution:false,
        custody:false
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/evaluate') {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error:'invalid_json' }, { status:400 });
      }
      return json(evaluatePosition(payload));
    }

    return json({ error:'not_found' }, { status:404 });
  }
};

function json(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type','application/json; charset=utf-8');
  return cors(new Response(JSON.stringify(body), { ...init, headers }));
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin','*');
  headers.set('Access-Control-Allow-Headers','Content-Type,Authorization,X-API-Key');
  headers.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  return new Response(response.body, {
    status:response.status,
    statusText:response.statusText,
    headers
  });
}
