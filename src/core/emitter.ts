type Handler = (...args: any[]) => void;

/** A tiny event emitter shared by the timer, the progress and the music queue. */
export class Emitter {
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.handlers.get(event);
