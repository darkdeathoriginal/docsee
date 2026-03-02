import { Router } from "express";

export default function imagesRouter(docker) {
  const router = Router();

  // List images
  router.get("/", async (req, res) => {
    try {
      const images = await docker.listImages({ all: true });
      res.json(images);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Pull image
  router.post("/pull", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ error: "Image name required" });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await docker.pull(image);
      docker.modem.followProgress(
        stream,
        (err, output) => {
          if (err) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ complete: true })}\n\n`);
          }
          res.end();
        },
        (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        },
      );
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Remove image
  router.delete("/:id", async (req, res) => {
    try {
      const image = docker.getImage(req.params.id);
      await image.remove({ force: req.query.force === "true" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
