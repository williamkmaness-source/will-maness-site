// route.ts — SSE pipeline-status endpoint.
// Emits a `status` event on connect and re-emits every 30s.
// Reads live data from Neon via PipelineStatusService.
// Verifiable end-to-end: curl -N /api/pipeline-status

import { neon } from "@neondatabase/serverless";
import { getPipelineStatuses } from "@/lib/PipelineStatusService";

export const dynamic = "force-dynamic";

const SEND_INTERVAL_MS = 30_000;
const PING_INTERVAL_MS = 25_000;

export async function GET() {
  const connectionString =
    process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING;

  const encoder = new TextEncoder();
  let sendInterval: ReturnType<typeof setInterval> | undefined;
  let pingInterval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const sql = connectionString ? neon(connectionString) : null;

      const send = async () => {
        try {
          let statuses;
          if (sql) {
            statuses = await getPipelineStatuses(sql);
          } else {
            // No database configured — emit unknown for all pipelines.
            statuses = [
              { pipeline: "311", status: "unknown", lastSuccessAt: null, lastAttemptAt: null, recordCount: null, error: null },
              { pipeline: "vendor-feed", status: "unknown", lastSuccessAt: null, lastAttemptAt: null, recordCount: null, error: null },
            ];
          }
          controller.enqueue(
            encoder.encode(`event: status\ndata: ${JSON.stringify(statuses)}\n\n`)
          );
        } catch {
          // On DB error, leave the connection alive — client retains last good state.
        }
      };

      await send();
      sendInterval = setInterval(send, SEND_INTERVAL_MS);
      pingInterval = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, PING_INTERVAL_MS);
    },
    cancel() {
      clearInterval(sendInterval);
      clearInterval(pingInterval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
