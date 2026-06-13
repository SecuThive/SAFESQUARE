/**
 * SSE proxy for /api/chat/stream
 *
 * Next.js rewrites() buffer streaming responses, so we use an explicit
 * App Router route handler to pipe the SSE stream from FastAPI to the client.
 */
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const authHeader = req.headers.get('Authorization') ?? '';
  const body = await req.text();

  const upstream = await fetch(`${backendUrl}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ detail: 'Backend error' }),
      { status: upstream.status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection':        'keep-alive',
    },
  });
}
