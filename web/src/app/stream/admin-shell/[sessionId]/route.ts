export const dynamic = "force-dynamic";

const FASTAPI = process.env.FASTAPI_URL ?? "http://127.0.0.1:9000";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const upstream = await fetch(`${FASTAPI}/api/admin/shell/${sessionId}/stream`, {
    headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new Response(`upstream ${upstream.status}`, { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
