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
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export const HOME: Cell = [0, 0];

/** Present from the first visit: the boulder behind the resident. */
export const START_PROPS: { at: Cell; prop: PropKind }[] = [{ at: [-1, -1], prop: 'rock' }];

export const MILESTONES: Milestone[] = [
  { id: 'bunga', minutes: 5, title: 'Bunga liar', done: 'Bunga liar mulai tumbuh di sela rumput.', doing: 'menanam bunga liar', work: 'plant', kind: 'prop', prop: 'flowers', at: [1, 1] },
  { id: 'petak-1', minutes: 15, title: 'Dua petak baru', done: 'Dua petak baru sudah ditarik naik dari awan.', doing: 'menarik dua petak baru dari awan', work: 'haul', kind: 'tiles', tiles: [[-2, 0], [2, 0]] },
  { id: 'bantal', minutes: 25, title: 'Bantal duduk', done: 'Sekarang ada bantal untuk duduk lama.', doing: 'menjahit bantal duduk', work: 'craft', kind: 'gear', gear: 'cushion' },
  { id: 'pohon-muda', minutes: 40, title: 'Pohon muda', done: 'Pohon muda ditanam di petak belakang.', doing: 'menanam pohon muda', work: 'plant', kind: 'prop', prop: 'sapling', at: [1, -1] },
  { id: 'petak-2', minutes: 60, title: 'Tiga petak baru', done: 'Tiga petak baru sudah menyambung ke pulau.', doing: 'menarik tiga petak baru dari awan', work: 'haul', kind: 'tiles', tiles: [[2, -1], [2, 1], [0, 2]] },
  { id: 'headphone', minutes: 80, title: 'Headphone', done: 'Headphone baru, dipakai setiap musik menyala.', doing: 'merakit headphone', work: 'craft', kind: 'gear', gear: 'headphones' },
  { id: 'kebun', minutes: 100, title: 'Kebun kecil', done: 'Kebun kecil sudah ditanami.', doing: 'menggarap kebun kecil', work: 'plant', kind: 'prop', prop: 'garden', at: [-2, 0] },
  { id: 'pohon-rindang', minutes: 125, title: 'Pohon rindang', done: 'Pohon mudanya tumbuh rindang.', doing: 'merawat pohon mudanya supaya rindang', work: 'plant', kind: 'prop', prop: 'tree', at: [1, -1] },
  { id: 'petak-3', minutes: 150, title: 'Empat petak baru', done: 'Empat petak baru, pulau makin lebar.', doing: 'menarik empat petak baru dari awan', work: 'haul', kind: 'tiles', tiles: [[-2, -1], [-2, 1], [0, -2], [1, -2]] },
  { id: 'buku', minutes: 180, title: 'Tumpukan buku', done: 'Buku-buku catatan menumpuk di samping laptop.', doing: 'menjilid buku catatan', work: 'craft', kind: 'gear', gear: 'books' },
  { id: 'rangka-pondok', minutes: 210, title: 'Rangka pondok', done: 'Rangka pondok sudah berdiri.', doing: 'memasang rangka pondok', work: 'build', kind: 'prop', prop: 'hut-frame', at: [-2, -1] },
  { id: 'pondok', minutes: 250, title: 'Pondok kayu', done: 'Pondok kayu selesai, atapnya rapat.', doing: 'memasang dinding dan atap pondok', work: 'build', kind: 'prop', prop: 'hut', at: [-2, -1] },
  { id: 'mug', minutes: 290, title: 'Mug teh', done: 'Ada mug teh hangat untuk jam istirahat.', doing: 'membentuk mug dari tanah liat', work: 'craft', kind: 'gear', gear: 'mug' },
  { id: 'petak-4', minutes: 330, title: 'Lima petak baru', done: 'Lima petak baru sudah ditarik naik.', doing: 'menarik lima petak baru dari awan', work: 'haul', kind: 'tiles', tiles: [[-1, -2], [-1, 2], [1, 2], [2, -2], [3, 0]] },
  { id: 'tiang', minutes: 370, title: 'Tiang listrik', done: 'Tiang listrik terpasang, kabelnya sampai ke awan.', doing: 'memasang tiang listrik', work: 'build', kind: 'prop', prop: 'pole', at: [2, -2] },
  { id: 'lampu', minutes: 420, title: 'Lampu taman', done: 'Lampu taman menyala setiap senja.', doing: 'memasang lampu taman', work: 'build', kind: 'prop', prop: 'lamp', at: [1, 1] },
  { id: 'papan', minutes: 470, title: 'Papan tulis', done: 'Papan tulis mencatat waktu fokusmu hari ini.', doing: 'membuat papan tulis', work: 'build', kind: 'prop', prop: 'board', at: [0, -2] },
  { id: 'petak-5', minutes: 540, title: 'Enam petak baru', done: 'Enam petak baru, pulau hampir utuh.', doing: 'menarik enam petak baru dari awan', work: 'haul', kind: 'tiles', tiles: [[-2, -2], [-2, 2], [2, 2], [-3, 0], [3, -1], [3, 1]] },
  { id: 'kolam', minutes: 600, title: 'Kolam', done: 'Kolam kecil terisi air.', doing: 'menggali kolam', work: 'dig', kind: 'prop', prop: 'pond', at: [2, 2] },
  { id: 'syal', minutes: 660, title: 'Syal rajut', done: 'Syal rajut untuk angin di ketinggian.', doing: 'merajut syal', work: 'craft', kind: 'gear', gear: 'scarf' },
  { id: 'kincir', minutes: 730, title: 'Kincir angin', done: 'Kincir angin berputar di ujung barat.', doing: 'membangun kincir angin', work: 'build', kind: 'prop', prop: 'windmill', at: [-3, 0] },
  { id: 'bangku', minutes: 800, title: 'Bangku kayu', done: 'Bangku kayu untuk melihat awan.', doing: 'membuat bangku kayu', work: 'build', kind: 'prop', prop: 'bench', at: [-1, 2] },
  { id: 'cemara', minutes: 880, title: 'Pohon cemara', done: 'Pohon cemara tumbuh di samping pondok.', doing: 'menanam pohon cemara', work: 'plant', kind: 'prop', prop: 'pine', at: [-2, -2] },
  { id: 'petak-6', minutes: 960, title: 'Delapan petak terakhir', done: 'Delapan petak terakhir. Pulau sudah utuh.', doing: 'menarik delapan petak terakhir dari awan', work: 'haul', kind: 'tiles', tiles: [[-3, -1], [-3, 1], [-1, -3], [0, -3], [1, -3], [-1, 3], [0, 3], [1, 3]] },
  { id: 'teleskop', minutes: 1050, title: 'Teleskop', done: 'Teleskop terpasang untuk malam yang cerah.', doing: 'merakit teleskop', work: 'build', kind: 'prop', prop: 'telescope', at: [2, 1] },
  { id: 'kupluk', minutes: 1140, title: 'Kupluk', done: 'Kupluk hangat, pas untuk belajar malam.', doing: 'merajut kupluk', work: 'craft', kind: 'gear', gear: 'beanie' },
  { id: 'balon', minutes: 1250, title: 'Balon udara', done: 'Balon udara terikat di ujung utara.', doing: 'menjahit dan memasang balon udara', work: 'build', kind: 'prop', prop: 'balloon', at: [-1, -3] },
  { id: 'air-terjun', minutes: 1400, title: 'Air terjun', done: 'Kolam meluap jadi air terjun ke lautan awan.', doing: 'membuka aliran air terjun dari kolam', work: 'dig', kind: 'prop', prop: 'waterfall', at: [2, 2] },
];

