import { exec } from "child_process";
import { Router } from "express";
import { existsSync, watch } from "fs";
import { open, stat } from "fs/promises";
import { basename, dirname, join } from "path";
import { StringDecoder } from "string_decoder";
import { promisify } from "util";

const execAsync = promisify(exec);

const router = Router();

const MAX_TAIL_BYTES = 256 * 1024; // Read at most 256KB for initial tail
const READ_CHUNK_SIZE = 64 * 1024; // Read live updates in 64KB chunks

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

// PM2 stores paths relative to original PM2_HOME on the host.
// In Docker, host's ~/.pm2 is mounted to /host-pm2, so remap paths.
function remapPath(logPath) {
  if (!logPath) return null;
  // eslint-disable-next-line no-undef
  const pm2Home = process.env.PM2_HOME || "";
  if (pm2Home) {
    const fileName = logPath.split(/[/\\]/).pop();
    const remapped = join(pm2Home, "logs", fileName);
    if (existsSync(remapped) || !existsSync(logPath)) {
      return remapped;
    }
  }
  return logPath;
}

// Read the last N lines of a file and return both lines and current byte size
async function readLastLines(filePath, maxLines) {
  let handle;
  try {
    handle = await open(filePath, "r");
    const fileStat = await handle.stat();
    const size = fileStat.size;
    if (size === 0) {
      return { lines: [], size: 0 };
    }

    const bytesToRead = Math.min(size, MAX_TAIL_BYTES);
    const startPos = size - bytesToRead;
    // eslint-disable-next-line no-undef
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, startPos);

    let text = stripAnsi(buffer.subarray(0, bytesRead).toString("utf8"));
    let lines = text.split(/\r?\n/);

    // If we started in the middle of the file, drop the first potentially truncated line
    if (startPos > 0 && lines.length > 1) {
      lines.shift();
    }

    // Drop trailing empty entry caused by a final newline
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    return {
      lines: lines.slice(-maxLines),
      size,
    };
  } catch {
    return { lines: [], size: 0 };
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
  }
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

// Get logs for a process (snapshot)
router.get("/:id/logs", async (req, res) => {
  try {
    const lines = Math.min(Math.max(parseInt(req.query.lines) || 100, 1), 1000);
    const processes = await getPm2List();
    const proc = processes.find(
      (p) => String(p.pm_id) === req.params.id || p.name === req.params.id,
    );

    if (!proc) {
      return res.status(404).json({ error: "Process not found" });
    }

    const outLogPath = remapPath(proc.pm2_env?.pm_out_log_path);
    const errLogPath = remapPath(proc.pm2_env?.pm_err_log_path);
    let logs = "";

    // Read out log
    if (outLogPath) {
      const { lines: outLines } = await readLastLines(outLogPath, lines);
      if (outLines.length > 0) {
        logs += "=== stdout ===\n" + outLines.join("\n");
      }
    }

    // Read err log (skip if merged with out log)
    if (errLogPath && errLogPath !== outLogPath) {
      const { lines: errLines } = await readLastLines(errLogPath, lines);
      if (errLines.length > 0) {
        logs += (logs ? "\n\n" : "") + "=== stderr ===\n" + errLines.join("\n");
      }
    }

    res.json({ logs: logs || "No logs available" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stream live logs for a process (SSE stream)
router.get("/:id/logs/stream", async (req, res) => {
  try {
    const lines = Math.min(Math.max(parseInt(req.query.lines) || 200, 1), 1000);
    const processes = await getPm2List();
    const proc = processes.find(
      (p) => String(p.pm_id) === req.params.id || p.name === req.params.id,
    );

    if (!proc) {
      return res.status(404).json({ error: "Process not found" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    let closed = false;
    const watchers = [];
    let pollInterval = null;
    let heartbeatInterval = null;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (pollInterval) clearInterval(pollInterval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      for (const w of watchers) {
        try {
          w.close();
        } catch {
          /* ignore close errors */
        }
      }
      watchers.length = 0;
    };

    req.on("close", cleanup);
    res.on("close", cleanup);

    const sendEvent = (payload) => {
      if (closed || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const outLogPath = remapPath(proc.pm2_env?.pm_out_log_path);
    const errLogPath = remapPath(proc.pm2_env?.pm_err_log_path);

    const targets = [];
    if (outLogPath) {
      targets.push({ path: outLogPath, stream: "stdout" });
    }
    if (errLogPath && errLogPath !== outLogPath) {
      targets.push({ path: errLogPath, stream: "stderr" });
    }

    // Initialize state and emit initial tail for each log file
    const states = [];
    for (const target of targets) {
      const { lines: initialLines, size } = await readLastLines(
        target.path,
        lines,
      );
      if (closed) return;

      for (const line of initialLines) {
        sendEvent({ log: line, stream: target.stream });
      }

      states.push({
        path: target.path,
        fileName: basename(target.path),
        dirName: dirname(target.path),
        stream: target.stream,
        offset: size,
        remainder: "",
        decoder: new StringDecoder("utf8"),
        reading: false,
        pending: false,
      });
    }

    const checkUpdates = async (state) => {
      if (closed) return;
      if (state.reading) {
        state.pending = true;
        return;
      }
      state.reading = true;

      let handle;
      try {
        const fileStat = await stat(state.path);
        const currentSize = fileStat.size;

        // Handle file truncation (e.g. pm2 flush) or log rotation
        if (currentSize < state.offset) {
          state.offset = 0;
          state.remainder = "";
          state.decoder = new StringDecoder("utf8");
        }

        if (currentSize > state.offset) {
          handle = await open(state.path, "r");
          while (state.offset < currentSize && !closed) {
            const bytesToRead = Math.min(
              READ_CHUNK_SIZE,
              currentSize - state.offset,
            );
            // eslint-disable-next-line no-undef
            const buffer = Buffer.alloc(bytesToRead);
            const { bytesRead } = await handle.read(
              buffer,
              0,
              bytesToRead,
              state.offset,
            );
            if (bytesRead <= 0) break;

            state.offset += bytesRead;
            const text =
              state.remainder + state.decoder.write(buffer.subarray(0, bytesRead));
            const parts = text.split("\n");
            state.remainder = parts.pop() || "";

            for (const rawLine of parts) {
              const cleaned = stripAnsi(rawLine.replace(/\r$/, ""));
              if (cleaned.length > 0) {
                sendEvent({ log: cleaned, stream: state.stream });
              }
            }
          }
        }
      } catch (err) {
        if (err && err.code === "ENOENT") {
          state.offset = 0;
          state.remainder = "";
          state.decoder = new StringDecoder("utf8");
        }
      } finally {
        if (handle) {
          await handle.close().catch(() => {});
        }
        state.reading = false;
        if (state.pending && !closed) {
          state.pending = false;
          checkUpdates(state);
        }
      }
    };

    // Group states by directory and attach fs.watch for instant updates
    const dirsToStates = new Map();
    for (const state of states) {
      if (!dirsToStates.has(state.dirName)) {
        dirsToStates.set(state.dirName, []);
      }
      dirsToStates.get(state.dirName).push(state);
    }

    for (const [dir, dirStates] of dirsToStates.entries()) {
      try {
        if (existsSync(dir)) {
          const watcher = watch(dir, (_eventType, filename) => {
            if (closed) return;
            for (const state of dirStates) {
              if (!filename || filename === state.fileName) {
                checkUpdates(state);
              }
            }
          });
          watcher.on("error", () => {});
          watchers.push(watcher);
        }
      } catch {
        /* fallback to polling interval */
      }
    }

    // Polling fallback (handles Docker Desktop bind mounts, NFS, and files created later)
    pollInterval = setInterval(() => {
      if (closed) return;
      for (const state of states) {
        checkUpdates(state);
      }
    }, 500);

    // Keep SSE connection alive through proxies
    heartbeatInterval = setInterval(() => {
      if (!closed && !res.writableEnded) {
        res.write(": heartbeat\n\n");
      }
    }, 20000);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else if (!res.writableEnded) {
      res.end();
    }
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
