export type ToastTone = "info" | "success" | "warning" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
  /** Keeps the toast until dismissed, for choices the user must not miss. */
  persistent?: boolean;
}

type Listener = (toasts: readonly Toast[]) => void;

let toasts: readonly Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function showToast(toast: Omit<Toast, "id">): number {
  const id = nextId;
  nextId += 1;
  toasts = [...toasts.filter((existing) => existing.message !== toast.message), { ...toast, id }];
  emit();
  return id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): readonly Toast[] {
  return toasts;
}
