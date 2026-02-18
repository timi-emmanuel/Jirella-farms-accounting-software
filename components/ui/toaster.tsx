"use client";

import { toast, ToastVariant, useToast } from "@/lib/toast";

const variantStyles: Record<ToastVariant, string> = {
  default: "border-slate-200 bg-white text-slate-900",
  destructive: "border-rose-200 bg-rose-50 text-rose-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-6 top-6 z-100 flex w-90 flex-col gap-3">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={`rounded-xl border px-4 py-3 shadow-lg ${variantStyles[item.variant ?? "default"]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {item.title ? (
                <p className="text-sm font-semibold">{item.title}</p>
              ) : null}
              {item.description ? (
                <p className="text-xs text-slate-600">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export { toast };
