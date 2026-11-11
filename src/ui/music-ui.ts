import { LinkError, SUGGESTIONS } from '../music/links';
import type { MusicPlayer } from '../music/player';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** The music panel: the link form, two suggested radios, the player, its controls and the queue. */
export function mountMusicUi(player: MusicPlayer, toast: (text: string) => void): void {
  const form = $<HTMLFormElement>('music-form');
  const input = $<HTMLInputElement>('music-link');
  const error = $('music-error');
  const empty = $('music-empty');
  const picks = $('music-picks');
  const now = $('now');
  const status = $('player-status');
  const title = $('now-title');
  const play = $<HTMLButtonElement>('music-play');
  const volume = $<HTMLInputElement>('music-volume');
  const loop = $<HTMLInputElement>('music-loop');
