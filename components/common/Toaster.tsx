"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { APP_CONFIG } from "@/config/app";
import { t } from "@/lib/i18n";
import {
  dismissToast,
  getToasts,
  subscribeToToasts,
  type Toast,
  type ToastTone,
} from "@/lib/toast";
import { cn } from "@/lib/utils";

const EMPTY: readonly Toast[] = [];

const TONES: Record<ToastTone, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "text-primary" },
  success: { icon: CheckCircle2, className: "text-success" },
  warning: { icon: AlertTriangle, className: "text-warning" },
  error: { icon: XCircle, className: "text-danger" },
};

function ToastItem({ toast }: { toast: Toast }) {
  const { icon: Icon, className } = TONES[toast.tone];

  useEffect(() => {
    if (toast.persistent) return;
    const timer = setTimeout(() => dismissToast(toast.id), APP_CONFIG.toastDurationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.persistent]);

  return (
    <div
      className="pointer-events-auto flex items-start gap-3 rounded-2xl bg-surface p-3 pl-4 shadow-panel"
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", className)} aria-hidden />
      <p className="min-w-0 flex-1 py-0.5 text-sm leading-snug text-foreground">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          className="min-h-9 shrink-0 rounded-lg px-2 text-sm font-semibold text-primary"
          onClick={() => {
            toast.action?.onClick();
            dismissToast(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label={t.common.dismiss}
        className="-my-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted"
        onClick={() => dismissToast(toast.id)}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToToasts, getToasts, () => EMPTY);
  return (
    <div className="pointer-events-none fixed inset-x-3 top-[calc(var(--safe-top)+76px)] z-60 mx-auto flex max-w-md flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
