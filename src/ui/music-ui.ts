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
  const queue = $('queue');

  const showError = (msg: string) => {
    error.textContent = msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  const add = (raw: string) => {
    try {
      player.add(raw, true);
      input.value = '';
      showError('');
    } catch (err) {
      if (err instanceof LinkError) showError(err.message);
      else showError('Tautan ini tidak bisa ditambahkan.');
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    add(input.value);
  });
  input.addEventListener('input', () => {
    if (error.textContent) showError('');
  });

