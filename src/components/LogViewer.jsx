import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

export default function LogViewer({
  containerId,
  containerName,
  streamUrl,
  title,
  onFlush,
}) {
  const [logs, setLogs] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const logsEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  const endpoint =
    streamUrl || (containerId ? `/api/containers/${containerId}/logs` : null);
  const heading = title || `Logs — ${containerName}`;

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStreaming = useCallback(async () => {
    if (!endpoint) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);
    setError(null);

    try {
      const token = api.getToken();
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to stream logs (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        const batch = [];
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.log !== undefined) {
                batch.push({
                  text: data.log,
                  stream: data.stream || "stdout",
                });
              }
            } catch {
              /* ignore */
            }
          }
        }

        if (batch.length > 0) {
          setLogs((prev) => {
            const next = [...prev, ...batch];
            return next.length > 500 ? next.slice(-500) : next;
          });
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Log streaming error:", err);
        setError(err.message || "Log stream disconnected");
      }
    }

    if (abortControllerRef.current === controller) {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setLogs([]);
      startStreaming();
    }, 0);

    return () => {
      clearTimeout(startTimer);
      stopStreaming();
    };
  }, [startStreaming, stopStreaming]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  async function handleFlush() {
    if (!onFlush) return;
    try {
      await onFlush();
      setLogs([]);
    } catch (err) {
      console.error("Failed to flush logs:", err);
    }
  }

  function handleToggleStream() {
    if (isStreaming) {
      stopStreaming();
    } else {
      setLogs([]);
      startStreaming();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h4 style={{ fontSize: "14px", fontWeight: 600 }}>📋 {heading}</h4>
          <span
            className={`status-badge ${isStreaming ? "running" : "paused"}`}
            style={{ fontSize: "11px", padding: "2px 8px" }}
          >
            <span className="status-dot" />
            {isStreaming ? "Live" : "Paused"}
          </span>
        </div>
        <div className="flex gap-2">
          {onFlush && (
            <button className="btn btn-ghost btn-sm" onClick={handleFlush}>
              🗑 Flush
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setLogs([])}>
            Clear
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleToggleStream}
          >
            {isStreaming ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>
      </div>
      <div className="log-viewer">
        {error ? (
          <div className="log-line stderr">{error}</div>
        ) : logs.length === 0 ? (
          <div className="text-muted">Waiting for logs...</div>
        ) : (
          logs.map((entry, i) => (
            <div
              key={i}
              className={`log-line${entry.stream === "stderr" ? " stderr" : ""}`}
            >
              {entry.text}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
