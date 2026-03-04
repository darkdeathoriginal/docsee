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

  // Aggregated stats for all running containers (SSE stream)
  router.get("/stats", async (req, res) => {
    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let closed = false;
      req.on("close", () => {
        closed = true;
      });

      const poll = async () => {
        if (closed) return;
        try {
          const containers = await docker.listContainers({
            filters: { status: ["running"] },
          });
          if (containers.length === 0) {
            res.write(
              `data: ${JSON.stringify({ cpu: "0.00", memory: 0, memoryLimit: 0, memoryPercent: "0.00", netIn: 0, netOut: 0, containerCount: 0 })}\n\n`,
            );
          } else {
            const statsPromises = containers.map(async (c) => {
              try {
                const container = docker.getContainer(c.Id);
                const stat = await container.stats({ stream: false });

                const cpuDelta =
                  stat.cpu_stats.cpu_usage.total_usage -
                  stat.precpu_stats.cpu_usage.total_usage;
                const systemDelta =
                  stat.cpu_stats.system_cpu_usage -
                  stat.precpu_stats.system_cpu_usage;
                const cpuCount = stat.cpu_stats.online_cpus || 1;
                const cpuPercent =
                  systemDelta > 0
                    ? (cpuDelta / systemDelta) * cpuCount * 100
                    : 0;

                const memUsage = stat.memory_stats.usage || 0;
                const memLimit = stat.memory_stats.limit || 0;

                let netIn = 0,
                  netOut = 0;
                if (stat.networks) {
                  Object.values(stat.networks).forEach((net) => {
                    netIn += net.rx_bytes;
                    netOut += net.tx_bytes;
                  });
                }

                return { cpuPercent, memUsage, memLimit, netIn, netOut };
              } catch {
                return {
                  cpuPercent: 0,
                  memUsage: 0,
                  memLimit: 0,
                  netIn: 0,
                  netOut: 0,
                };
              }
            });

            const results = await Promise.all(statsPromises);

            const totalCpu = results.reduce((sum, r) => sum + r.cpuPercent, 0);
            const totalMem = results.reduce((sum, r) => sum + r.memUsage, 0);
            const maxMemLimit = Math.max(...results.map((r) => r.memLimit));
            const totalMemLimit = results.reduce(
              (sum, r) => sum + r.memLimit,
              0,
            );
            const totalNetIn = results.reduce((sum, r) => sum + r.netIn, 0);
            const totalNetOut = results.reduce((sum, r) => sum + r.netOut, 0);

            res.write(
              `data: ${JSON.stringify({
                cpu: totalCpu.toFixed(2),
                memory: totalMem,
                memoryLimit: totalMemLimit,
                memoryPercent:
                  totalMemLimit > 0
                    ? ((totalMem / totalMemLimit) * 100).toFixed(2)
                    : "0.00",
                netIn: totalNetIn,
                netOut: totalNetOut,
                containerCount: containers.length,
              })}\n\n`,
            );
          }
        } catch {
          /* ignore errors during polling */
        }

        if (!closed) {
          setTimeout(poll, 3000);
        }
      };

      poll();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
