import "server-only";
import { LockTimeoutError } from "../errors";

/**
 * FIFO async mutex with an acquisition timeout. A caller that times out is rejected and never runs,
 * but its queue slot is released only after the previous holder finished so ordering stays intact.
 */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly timeoutMs = 30_000) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    const mine = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tail = previous.then(() => mine);

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        void previous.then(release);
        reject(new LockTimeoutError(this.timeoutMs));
      }, this.timeoutMs);
      timer.unref?.();

      void previous.then(async () => {
        if (settled) return; // timed out while waiting; slot already scheduled for release
        settled = true;
        clearTimeout(timer);
        try {
          resolve(await fn());
        } catch (error) {
          reject(error);
        } finally {
          release();
        }
      });
    });
  }
}
