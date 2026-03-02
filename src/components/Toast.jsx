import { useCallback, useEffect, useState } from "react";

export default function Toast({ children }) {
  return <div className="toast-container">{children}</div>;
}

export function ToastMessage({ type = "info", message, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const icons = { success: "✅", error: "❌", info: "ℹ️" };

  return (
    <div className={`toast ${type}`}>
      <span>{icons[type]}</span>
      <span>{message}</span>
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
