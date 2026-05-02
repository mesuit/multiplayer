import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/ytsearch", async (req, res) => {
  const query = req.query.query as string | undefined;
  if (!query || !query.trim()) {
    res.status(400).json({ status: "error", message: "Missing query parameter" });
    return;
  }

  try {
    const upstream = `https://my-rest-apis-six.vercel.app/yts?query=${encodeURIComponent(query.trim())}`;
    const response = await fetch(upstream, {
      signal: AbortSignal.timeout(14000),
    });
    if (!response.ok) {
      res.status(502).json({ status: "error", message: "Upstream search failed" });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(504).json({ status: "error", message: "Search timed out or unavailable" });
  }
});

export default router;
