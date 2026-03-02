import { Router } from "express";

export default function systemRouter(docker) {
  const router = Router();

  router.get("/info", async (req, res) => {
    try {
      const info = await docker.info();
      res.json(info);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/version", async (req, res) => {
    try {
      const version = await docker.version();
      res.json(version);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/df", async (req, res) => {
    try {
      const df = await docker.df();
      res.json(df);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
