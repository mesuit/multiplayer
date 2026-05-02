import { Router, type IRouter } from "express";
import { Readable } from "stream";

const router: IRouter = Router();

router.get("/dl", async (req, res) => {
  const url = req.query.url as string | undefined;
  const filename = (req.query.filename as string | undefined) || "download";

  if (!url || !url.trim()) {
    res.status(400).json({ error: "url parameter is required" });
    return;
  }

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Upstream returned ${upstream.status}` });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    if (upstream.body) {
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    } else {
      res.end();
    }
  } catch {
    if (!res.headersSent) {
      res.status(504).json({ error: "Download timed out or failed" });
    }
  }
});

export default router;
