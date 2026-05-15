// route.ts — SSE pipeline-status endpoint.
// Emits a `status` event on connect and re-emits every 10s.
// Payload is a static shape; real data sources wire in via issue #46/#47.
// Verifiable end-to-end: curl -N /api/pipeline-status

export const dynamic = 'force-dynamic';

type PipelineStatus = {
  pipeline: string;
  status: 'success' | 'failed' | 'running' | 'unknown';
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  recordCount: number | null;
  error: string | null;
};

const STATIC_STATUS: PipelineStatus[] = [
  {
    pipeline: '311',
    status: 'unknown',
    lastSuccessAt: null,
    lastAttemptAt: null,
    recordCount: null,
    error: null,
  },
  {
    pipeline: 'chess',
    status: 'unknown',
    lastSuccessAt: null,
    lastAttemptAt: null,
    recordCount: null,
    error: null,
  },
];

export async function GET() {
  const encoder = new TextEncoder();
  let sendInterval: ReturnType<typeof setInterval> | undefined;
  let pingInterval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        const data = JSON.stringify(STATIC_STATUS);
        controller.enqueue(encoder.encode(`event: status\ndata: ${data}\n\n`));
      };

      send();
      sendInterval = setInterval(send, 10_000);
      // SSE comment pings keep the connection alive through proxies.
      pingInterval = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 25_000);
    },
    cancel() {
      clearInterval(sendInterval);
      clearInterval(pingInterval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
