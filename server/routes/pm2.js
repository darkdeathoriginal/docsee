import { exec } from "child_process";
import { Router } from "express";
import { promisify } from "util";

const execAsync = promisify(exec);

const router = Router();

// Helper to strip ANSI escape codes
function stripAnsi(str) {
  return (
    str
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
      // eslint-disable-next-line no-control-regex
      .replace(/\x1B\][^\x07]*\x07/g, "")
  );
}

// Helper to run pm2 jlist and parse output
async function getPm2List() {
  try {
    const { stdout } = await execAsync("pm2 jlist", {
      // eslint-disable-next-line no-undef
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    });
    // Strip any ANSI codes and find the JSON array in the output
    const clean = stripAnsi(stdout).trim();
    const jsonStart = clean.indexOf("[");
    if (jsonStart === -1) {
      return [];
    }
    return JSON.parse(clean.slice(jsonStart));
  } catch (err) {
    // If pm2 is not installed or not running
    if (
      err.message.includes("not found") ||
      err.message.includes("not recognized")
    ) {
      throw new Error("PM2 is not installed or not in PATH");
    }
    throw err;
  }
}

// List all PM2 processes
router.get("/", async (req, res) => {
  try {
    const processes = await getPm2List();
    const simplified = processes.map((p) => ({
      pm_id: p.pm_id,
      name: p.name,
      pid: p.pid,
      status: p.pm2_env?.status || "unknown",
      cpu: p.monit?.cpu || 0,
      memory: p.monit?.memory || 0,
      uptime: p.pm2_env?.pm_uptime || 0,
      restarts: p.pm2_env?.restart_time || 0,
      unstableRestarts: p.pm2_env?.unstable_restarts || 0,
      createdAt: p.pm2_env?.created_at || 0,
      execMode: p.pm2_env?.exec_mode || "unknown",
      nodeVersion: p.pm2_env?.node_version || "N/A",
      script: p.pm2_env?.pm_exec_path || "",
      cwd: p.pm2_env?.pm_cwd || "",
      instances: p.pm2_env?.instances || 1,
      interpreter: p.pm2_env?.exec_interpreter || "node",
      autorestart: p.pm2_env?.autorestart ?? true,
      watchMode: p.pm2_env?.watch || false,
      version: p.pm2_env?.version || "N/A",
    }));
    res.json(simplified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get detailed info for a specific process
router.get("/:id/describe", async (req, res) => {
  try {
    const processes = await getPm2List();
    const proc = processes.find(
      (p) => String(p.pm_id) === req.params.id || p.name === req.params.id,
    );
    if (!proc) {
      return res.status(404).json({ error: "Process not found" });
    }
    res.json(proc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start a process
router.post("/:id/start", async (req, res) => {
  try {
    await execAsync(`pm2 start ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop a process
router.post("/:id/stop", async (req, res) => {
  try {
    await execAsync(`pm2 stop ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restart a process
router.post("/:id/restart", async (req, res) => {
  try {
    await execAsync(`pm2 restart ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reload a process (graceful restart)
router.post("/:id/reload", async (req, res) => {
  try {
    await execAsync(`pm2 reload ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a process from PM2
router.delete("/:id", async (req, res) => {
  try {
    await execAsync(`pm2 delete ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get logs for a process
router.get("/:id/logs", async (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 100;
    const processes = await getPm2List();
    const proc = processes.find(
      (p) => String(p.pm_id) === req.params.id || p.name === req.params.id,
    );

    if (!proc) {
      return res.status(404).json({ error: "Process not found" });
    }

    const outLogPath = proc.pm2_env?.pm_out_log_path;
    const errLogPath = proc.pm2_env?.pm_err_log_path;
    let logs = "";

    // Read out log
    if (outLogPath) {
      try {
        const { stdout: tail } = await execAsync(
          `tail -n ${lines} "${outLogPath}"`,
        );
        if (tail.trim()) {
          logs += "=== stdout ===\n" + tail;
        }
      } catch {
        /* file may not exist yet */
      }
    }

    // Read err log
    if (errLogPath) {
      try {
        const { stdout: tail } = await execAsync(
          `tail -n ${lines} "${errLogPath}"`,
        );
        if (tail.trim()) {
          logs += (logs ? "\n\n" : "") + "=== stderr ===\n" + tail;
        }
      } catch {
        /* file may not exist yet */
      }
    }

    res.json({ logs: logs || "No logs available" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Flush logs
router.post("/:id/flush", async (req, res) => {
  try {
    await execAsync(`pm2 flush ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PM2 monit-style stats (SSE stream)
router.get("/stream/stats", async (req, res) => {
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
        const processes = await getPm2List();
        const stats = processes.map((p) => ({
          pm_id: p.pm_id,
          name: p.name,
          pid: p.pid,
          status: p.pm2_env?.status || "unknown",
          cpu: p.monit?.cpu || 0,
          memory: p.monit?.memory || 0,
          restarts: p.pm2_env?.restart_time || 0,
          uptime: p.pm2_env?.pm_uptime || 0,
        }));

        const totalCpu = stats.reduce((sum, p) => sum + p.cpu, 0);
        const totalMemory = stats.reduce((sum, p) => sum + p.memory, 0);
        const online = stats.filter((s) => s.status === "online").length;
        const stopped = stats.filter(
          (s) => s.status === "stopped" || s.status === "errored",
        ).length;

        res.write(
          `data: ${JSON.stringify({
            processes: stats,
            summary: {
              total: stats.length,
              online,
              stopped,
              totalCpu: totalCpu.toFixed(1),
              totalMemory,
            },
          })}\n\n`,
        );
      } catch {
        /* ignore poll errors */
      }
      if (!closed) setTimeout(poll, 2000);
    };

    poll();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
