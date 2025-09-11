"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastType = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  id?: string;
  message: string;
  type?: ToastType;
  duration?: number; // ms
}

interface ToastRecord extends Required<Omit<ToastOptions, "id" | "type" | "duration">> {
  id: string;
  type: ToastType;
  duration: number;
  closing: boolean;
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const hardRemove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timeoutsRef.current[id];
    if (t) {
      clearTimeout(t);
      delete timeoutsRef.current[id];
    }
  }, []);

  const startClose = useCallback((id: string) => {
    // mark closing to trigger exit animation then hard remove
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, closing: true } : t)));
    // Allow animation to play before removal
    setTimeout(() => hardRemove(id), 220);
  }, [hardRemove]);

  const showToast = useCallback((opts: ToastOptions) => {
    const id = opts.id ?? Math.random().toString(36).slice(2);
    const toast: ToastRecord = {
      id,
      message: opts.message,
      type: opts.type ?? "info",
      duration: Math.max(1500, Math.min(opts.duration ?? 2600, 8000)),
      closing: false,
    };
    setToasts((prev) => [...prev, toast]);
    timeoutsRef.current[id] = setTimeout(() => startClose(id), toast.duration);
  }, [startClose]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast viewport */}
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRequestClose={() => startClose(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastItem({ toast, onRequestClose }: { toast: ToastRecord; onRequestClose: () => void }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setEntered(true), 10); // next tick to trigger CSS transition
    return () => clearTimeout(id);
  }, []);

  const base = "pointer-events-auto min-w-[220px] max-w-[360px] rounded-lg px-4 py-3 shadow-lg ring-1 backdrop-blur transition-all duration-200 ease-out";
  const palette = toast.type === "success" ? "bg-emerald-50/80 ring-emerald-200 text-emerald-900"
    : toast.type === "warning" ? "bg-amber-50/80 ring-amber-200 text-amber-900"
    : toast.type === "error" ? "bg-rose-50/80 ring-rose-200 text-rose-900"
    : "bg-slate-50/80 ring-slate-200 text-slate-900 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-slate-700";

  const motion = toast.closing
    ? "opacity-0 translate-y-2"
    : entered
      ? "opacity-100 translate-y-0"
      : "opacity-0 -translate-y-1";

  return (
    <div className={[base, palette, motion].join(" ")} role="status">
      <div className="text-sm leading-relaxed">{toast.message}</div>
    </div>
  );
}
