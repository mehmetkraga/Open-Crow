import type { KragaAPI } from '../electron/preload.ts';

declare global {
  interface Window {
    kragaAPI: KragaAPI;
  }
}

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

