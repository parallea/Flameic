/// <reference types="vite/client" />

interface Window {
  __TAURI__?: {
    core?: {
      invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
    };
    event?: {
      listen<T = unknown>(
        event: string,
        handler: (event: { payload: T }) => void
      ): Promise<() => void>;
    };
  };
}
