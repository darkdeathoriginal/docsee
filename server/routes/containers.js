import { Router } from "express";

export default function containersRouter(docker) {
  const router = Router();

  // List all containers
  router.get("/", async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true });
      res.json(containers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Inspect container
  router.get("/:id/inspect", async (req, res) => {
    try {
      const container = docker.getContainer(req.params.id);
      const data = await container.inspect();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Container stats (SSE stream)
  router.get("/:id/stats", async (req, res) => {
    try {
      const container = docker.getContainer(req.params.id);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await container.stats({ stream: true });

      stream.on("data", (chunk) => {
        try {
          const stat = JSON.parse(chunk.toString());
          // Calculate CPU %
          const cpuDelta =
            stat.cpu_stats.cpu_usage.total_usage -
            stat.precpu_stats.cpu_usage.total_usage;
          const systemDelta =
            stat.cpu_stats.system_cpu_usage -
            stat.precpu_stats.system_cpu_usage;
          const cpuCount = stat.cpu_stats.online_cpus || 1;
          const cpuPercent =
            systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0;

          // Calculate Memory
          const memUsage = stat.memory_stats.usage || 0;
          const memLimit = stat.memory_stats.limit || 1;
          const memPercent = (memUsage / memLimit) * 100;

          // Network
          let netIn = 0,
            netOut = 0;
          if (stat.networks) {
            Object.values(stat.networks).forEach((net) => {
              netIn += net.rx_bytes;
              netOut += net.tx_bytes;
            });
          }

          res.write(
            `data: ${JSON.stringify({
              cpu: cpuPercent.toFixed(2),
              memory: memUsage,
              memoryLimit: memLimit,
              memoryPercent: memPercent.toFixed(2),
              netIn,
              netOut,
            })}\n\n`,
          );
        } catch {
          /* ignore parse errors */
        }
      });

      stream.on("end", () => res.end());
      req.on("close", () => stream.destroy());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Container logs (SSE stream)
  router.get("/:id/logs", async (req, res) => {
    try {
      const container = docker.getContainer(req.params.id);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: 200,
        timestamps: true,
      });

      stream.on("data", (chunk) => {
        // Docker multiplexed stream: first 8 bytes are header
        const lines = chunk.toString().split("\n").filter(Boolean);
        lines.forEach((line) => {
          // Strip Docker stream header bytes (first 8 bytes per frame)
          const cleaned = line.length > 8 ? line.substring(8) : line;
          res.write(`data: ${JSON.stringify({ log: cleaned })}\n\n`);
        });
      });

      stream.on("end", () => res.end());
      req.on("close", () => stream.destroy());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Start container
  router.post("/:id/start", async (req, res) => {
    try {
      const container = docker.getContainer(req.params.id);
      await container.start();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stop container
  router.post("/:id/stop", async (req, res) => {
    try {
      const container = docker.getContainer(req.params.id);
      await container.stop();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Restart container
  router.post("/:id/restart", async (req, res) => {
    try {
      const container = docker.getContainer(req.params.id);
      await container.restart();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Remove container
  router.delete("/:id", async (req, res) => {
    try {
      const container = docker.getContainer(req.params.id);
      await container.remove({ force: req.query.force === "true" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
