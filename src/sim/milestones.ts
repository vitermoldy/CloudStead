// What the island becomes, in the order it grows. Minutes are total focus minutes.
// The grid: x to the east, z toward the camera; the resident sits on (0, 0).

export type Cell = readonly [number, number];

export type PropKind =
  | 'rock' | 'flowers' | 'sapling' | 'tree' | 'garden' | 'hut-frame' | 'hut' | 'pole' | 'lamp'
  | 'board' | 'pond' | 'windmill' | 'bench' | 'pine' | 'telescope' | 'balloon' | 'waterfall';

export type Gear = 'cushion' | 'headphones' | 'books' | 'mug' | 'scarf' | 'beanie';

/** How the resident works on it: hammer and planks, shovel and can, a rope from the clouds, or by hand at the seat. */
export type Work = 'build' | 'plant' | 'dig' | 'haul' | 'craft';

export interface Milestone {
  id: string;
  minutes: number;
  title: string;
  /** One sentence for the story line once it stands. */
  done: string;
  /** What the resident is doing while it is in progress, after "<name> sedang". */
  doing: string;
  work: Work;
  kind: 'tiles' | 'prop' | 'gear';
  tiles?: Cell[];
  at?: Cell;
  prop?: PropKind;
  gear?: Gear;
}

/** The nine cells the island starts with. */
export const START_TILES: Cell[] = [
  [-1, -1], [0, -1], [1, -1],
