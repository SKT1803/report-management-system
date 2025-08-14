import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import "./Toast.css";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((text, { type = "success", ttl = 2200 } = {}) => {
    const id =
      (globalThis.crypto?.randomUUID && crypto.randomUUID()) ||
      String(Date.now() + Math.random());
    setToasts((list) => [...list, { id, text, type }]);
    setTimeout(() => remove(id), ttl);
    return id;
  }, [remove]);

  const api = useMemo(
    () => ({
      show,
      success: (t, o) => show(t, { ...o, type: "success" }),
      error: (t, o) => show(t, { ...o, type: "error" }),
      info: (t, o) => show(t, { ...o, type: "info" }),
    }),
    [show]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "success" && <CheckCircle2 size={18} />}
            {t.type === "error" && <AlertCircle size={18} />}
            {t.type === "info" && <Info size={18} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx) || { show: () => {}, success: () => {}, error: () => {}, info: () => {} };
}
