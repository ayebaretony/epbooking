import { createContext } from "react";

export type ToastKind = "success" | "error";
export type ToastContextValue = { show: (message: string, kind?: ToastKind) => void };

export const ToastContext = createContext<ToastContextValue | null>(null);
