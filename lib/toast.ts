"use client";

import { useEffect, useState } from "react";

export type ToastVariant = "default" | "destructive" | "success";

export type ToastMessage = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type Listener = (toasts: ToastMessage[]) => void;

let toasts: ToastMessage[] = [];
const listeners = new Set<Listener>();

const emit = () => {
  listeners.forEach((listener) => listener(toasts));
};

export const toast = (message: Omit<ToastMessage, "id">) => {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const next: ToastMessage = {
    id,
    variant: "default",
    duration: 15000,
    ...message,
  };
  toasts = [next, ...toasts].slice(0, 6);
  emit();

  const timeout = next.duration ?? 15000;
  if (timeout > 0) {
    setTimeout(() => dismiss(id), timeout);
  }

  return id;
};

export const dismiss = (id: string) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};

export const useToast = () => {
  const [state, setState] = useState<ToastMessage[]>(toasts);

  useEffect(() => {
    const listener: Listener = (next) => setState([...next]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { toasts: state, toast, dismiss };
};
