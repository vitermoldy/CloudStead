type Handler = (...args: any[]) => void;

/** A tiny event emitter shared by the timer, the progress and the music queue. */
export class Emitter {
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler): () => void {
