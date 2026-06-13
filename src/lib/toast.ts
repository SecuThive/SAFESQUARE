// 전역 토스트 모듈 — React context 없이 어디서나 import해서 사용
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts() {
  return [...toasts];
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

function addToast(message: string, type: ToastType, duration: number) {
  const id = Math.random().toString(36).slice(2, 9);
  toasts = [...toasts, { id, type, message, duration }];
  notify();
  setTimeout(() => dismissToast(id), duration);
}

export const toast = {
  success: (message: string, duration = 3000) => addToast(message, 'success', duration),
  error:   (message: string, duration = 4500) => addToast(message, 'error',   duration),
  warning: (message: string, duration = 3500) => addToast(message, 'warning', duration),
  info:    (message: string, duration = 3000) => addToast(message, 'info',    duration),
};
