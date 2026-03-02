import { Router } from "express";

export default function networksRouter(docker) {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const networks = await docker.listNetworks();
      res.json(networks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { name, driver } = req.body;
      const network = await docker.createNetwork({
        Name: name,
        Driver: driver || "bridge",
      });
      res.json(network);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const network = docker.getNetwork(req.params.id);
      await network.remove();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
