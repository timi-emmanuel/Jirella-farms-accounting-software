"use client";

import { useEffect } from "react";
import { toast } from "@/lib/toast";

export function AlertToastBridge() {
  useEffect(() => {
    const original = window.alert;
    window.alert = (message?: any) => {
      const description = typeof message === "string" ? message : JSON.stringify(message);
      toast({ title: "Notice", description });
    };

    return () => {
      window.alert = original;
    };
  }, []);

  return null;
}
