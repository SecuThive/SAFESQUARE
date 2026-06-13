// 전역 컨펌 모듈 — React context 없이 어디서나 import해서 사용
export interface ConfirmOptions {
  title?: string;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

let registeredFn: ConfirmFn | null = null;

export function registerConfirm(fn: ConfirmFn) {
  registeredFn = fn;
}

export function unregisterConfirm() {
  registeredFn = null;
}

export function confirm(message: string, options?: ConfirmOptions): Promise<boolean> {
  if (!registeredFn) {
    // ConfirmDialog가 마운트되기 전 fallback
    return Promise.resolve(window.confirm(message));
  }
  return registeredFn(message, options);
}
