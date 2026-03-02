import { useEffect, useRef, useState } from "react";
import { api } from "../api";

export default function LogViewer({ containerId, containerName }) {
  const [logs, setLogs] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const logsEndRef = useRef(null);
  const readerRef = useRef(null);

  useEffect(() => {
    startStreaming();
    return () => stopStreaming();
  }, [containerId]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  async function startStreaming() {
    setIsStreaming(true);
    try {
      const token = api.getToken();
      const res = await fetch(`/api/containers/${containerId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.log) {
                setLogs((prev) => {
                  const next = [...prev, data.log];
                  return next.length > 500 ? next.slice(-500) : next;
                });
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch (err) {
      console.error("Log streaming error:", err);
    }
    setIsStreaming(false);
  }

  function stopStreaming() {
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    setIsStreaming(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 style={{ fontSize: "14px", fontWeight: 600 }}>
          📋 Logs — {containerName}
        </h4>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setLogs([])}>
            Clear
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => (isStreaming ? stopStreaming() : startStreaming())}
          >
            {isStreaming ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>
      </div>
      <div className="log-viewer">
        {logs.length === 0 ? (
          <div className="text-muted">No logs available...</div>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="log-line">
              {line}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
