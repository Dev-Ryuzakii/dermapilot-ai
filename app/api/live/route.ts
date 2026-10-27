import { cookies } from 'next/headers';
import { currentUser, names, anonKey, apiUrl } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const encoder = new TextEncoder();
const watchedTables = new Set(['skin_assessments', 'profiles', 'skincare_routines', 'routine_steps']);

export async function GET(request: Request) {
  const token = (await cookies()).get(names.access)?.value;
  if (!token) return new Response('Sign in to receive updates.', { status: 401 });

  let userId: string;
  try {
    userId = (await currentUser(token)).id;
  } catch {
    return new Response('Sign in to receive updates.', { status: 401 });
  }

  if (typeof WebSocket === 'undefined') return new Response('Live updates are unavailable.', { status: 503 });

  const key = anonKey();
  const socketUrl = new URL(`${apiUrl().replace(/^http/, 'ws').replace(/\/$/, '')}/realtime/v1/websocket`);
  socketUrl.searchParams.set('apikey', key);
  socketUrl.searchParams.set('vsn', '1.0.0');
  socketUrl.searchParams.set('token', token);

  let socket: WebSocket | null = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let lifetime: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (value: string) => {
        if (!closed) controller.enqueue(encoder.encode(value));
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (lifetime) clearTimeout(lifetime);
        request.signal.removeEventListener('abort', cleanup);
        if (socket) { socket.onopen = null; socket.onmessage = null; socket.onerror = null; socket.onclose = null; try { socket.close(); } catch { /* Connection may still be opening. */ } }
        try { controller.close(); } catch { /* The browser may already have disconnected. */ }
      };
      stop = cleanup;

      request.signal.addEventListener('abort', cleanup, { once: true });
      write('retry: 5000\n: connected\n\n');
      try {
        socket = new WebSocket(socketUrl);
      } catch {
        cleanup();
        return;
      }
      socket.onopen = () => {
        const postgresChanges = [
          { event: '*', schema: 'public', table: 'skin_assessments', filter: `user_id=eq.${userId}` },
          { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          { event: '*', schema: 'public', table: 'skincare_routines', filter: `user_id=eq.${userId}` },
          { event: '*', schema: 'public', table: 'routine_steps' },
        ];
        socket?.send(JSON.stringify({
          topic: `realtime:dermapilot:${userId}`,
          event: 'phx_join',
          payload: { topic: `realtime:dermapilot:${userId}`, postgres_changes: postgresChanges },
          ref: '1',
        }));
      };
      socket.onmessage = event => {
        try {
          const message = JSON.parse(String(event.data));
          const payload = message.payload;
          const table = payload?.table ?? payload?.data?.table;
          const kind = payload?.type ?? payload?.data?.type;
          if (kind !== 'postgres_changes' || !watchedTables.has(table)) return;
          const row = payload.new ?? payload.data?.record ?? payload.old ?? payload.data?.old_record;
          if (table === 'profiles' && row?.id && row.id !== userId) return;
          if (table !== 'profiles' && row?.user_id && row.user_id !== userId) return;
          write(`event: change\ndata: ${JSON.stringify({ table })}\n\n`);
        } catch { /* Ignore unrelated or malformed upstream messages. */ }
      };
      socket.onerror = cleanup;
      socket.onclose = cleanup;
      heartbeat = setInterval(() => {
        write(': keepalive\n\n');
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null }));
      }, 20000);
      lifetime = setTimeout(cleanup, 110000);
    },
    cancel() { stop(); },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
