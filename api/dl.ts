export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const filename = searchParams.get("filename") || "download";

  if (!url) {
    return new Response("url required", { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });

    if (!upstream.ok) {
      return new Response("Upstream fetch failed", { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Download failed", { status: 502 });
  }
}
