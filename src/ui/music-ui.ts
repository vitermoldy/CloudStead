import { LinkError, SUGGESTIONS } from '../music/links';
import type { MusicPlayer } from '../music/player';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** The music panel: the link form, two suggested radios, the player, its controls and the queue. */
export function mountMusicUi(player: MusicPlayer, toast: (text: string) => void): void {
