import { reducedMotion } from '../core/emitter';

export type CursorState = 'idle' | 'char' | 'pet' | 'tile' | 'ghost' | 'prop' | 'grab';

/**
 * The pointer over the island: a dot that sits exactly on the mouse and a ring that follows it a
 * moment later, stretching along fast moves and changing shape over what it can touch. Mouse
