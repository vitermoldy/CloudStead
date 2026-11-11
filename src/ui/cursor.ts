import { reducedMotion } from '../core/emitter';

export type CursorState = 'idle' | 'char' | 'pet' | 'tile' | 'ghost' | 'prop' | 'grab';

/**
 * The pointer over the island: a dot that sits exactly on the mouse and a ring that follows it a
 * moment later, stretching along fast moves and changing shape over what it can touch. Mouse
 * only; over the interface the system pointer takes over, so every control keeps its own.
 */
export class Cursor {
  readonly enabled: boolean;
  private el: HTMLElement;
  private ring: HTMLElement;
  private dot: HTMLElement;
  private label: HTMLElement;
  private x = -100;
