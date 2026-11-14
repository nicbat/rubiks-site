import type { ScrambleRequest, ScrambleResult } from "../scramble/index.js";
export interface ScrambleWorker {
  postMessage(message: { type: "generate"; id: number; eventId: "222" }): void;
  addEventListener(
    type: "message" | "error" | "messageerror",
    listener: (event: any) => void,
  ): void;
  removeEventListener(
    type: "message" | "error" | "messageerror",
    listener: (event: any) => void,
  ): void;
  terminate(): void;
}
/** One request at a time. Abort terminates its worker; successful calls retain warm tables. */
export function createScrambleProvider(options?: {
  /** Deterministic lifecycle hook for tests. Production constructs a module Worker lazily. */
  createWorker?: () => ScrambleWorker;
}): {
  generateScramble(request: ScrambleRequest): Promise<ScrambleResult>;
  destroy(): void;
};
