import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// The browser only ever talks to this app. We pass /api/* through to the real
// API, which keeps the session cookie first-party and means no CORS in prod.
const upstream = () => {
  if (process.env.API_URL) return process.env.API_URL.replace(/\/$/, '');
  if (process.env.API_HOSTPORT) return `http://${process.env.API_HOSTPORT}`;
  return 'http://localhost:4000';
};

const PASS_THROUGH = ['content-type', 'cookie', 'origin', 'user-agent', 'accept', 'x-forwarded-for'];

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${upstream()}/api/${path.join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of PASS_THROUGH) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? await req.text() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return Response.json(
      { error: { message: 'The server is waking up or unreachable. Try again in a moment.' } },
      { status: 502 },
    );
  }

  const out = new Headers();
  const type = res.headers.get('content-type');
  if (type) out.set('content-type', type);
  for (const cookie of res.headers.getSetCookie()) out.append('set-cookie', cookie);

  const body = res.status === 204 || res.status === 304 ? null : await res.arrayBuffer();
  return new Response(body, { status: res.status, headers: out });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
