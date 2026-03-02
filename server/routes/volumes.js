import { Router } from "express";

export default function volumesRouter(docker) {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const data = await docker.listVolumes();
      res.json(data.Volumes || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { name, driver } = req.body;
      const volume = await docker.createVolume({
        Name: name,
        Driver: driver || "local",
      });
      res.json(volume);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/:name", async (req, res) => {
    try {
      const volume = docker.getVolume(req.params.name);
      await volume.remove({ force: req.query.force === "true" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
