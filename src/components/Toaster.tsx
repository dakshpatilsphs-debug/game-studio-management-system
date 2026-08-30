import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import { cn } from "../utils/cn";

type ToastTone = "free" | "occupied" | "warn" | "danger";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastCtx = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = "free") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2600);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "toast-in pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-2xl backdrop-blur-md",
              toneStyles[t.tone]
            )}
          >
            {iconFor(t.tone)}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

const toneStyles: Record<ToastTone, string> = {
  free: "border-free/30 bg-panel/90 text-free",
  occupied: "border-occupied/30 bg-panel/90 text-occupied",
  warn: "border-warn/30 bg-panel/90 text-warn",
  danger: "border-danger/30 bg-panel/90 text-danger",
};

function iconFor(tone: ToastTone) {
  const cls = "h-4 w-4";
  if (tone === "danger") return <XCircle className={cls} />;
  if (tone === "warn") return <AlertTriangle className={cls} />;
  if (tone === "occupied") return <Info className={cls} />;
  return <CheckCircle2 className={cls} />;
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
