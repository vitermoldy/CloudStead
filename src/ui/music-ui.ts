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

  for (const s of SUGGESTIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--secondary btn--sm';
    b.textContent = s.label;
    b.addEventListener('click', () => add(s.url));
    picks.append(b);
  }

  play.addEventListener('click', () => player.toggle());
  $('music-prev').addEventListener('click', () => player.prev());
  $('music-next').addEventListener('click', () => player.next());
  volume.addEventListener('input', () => player.setVolume(Number(volume.value)));
  loop.addEventListener('change', () => player.setLoop(loop.checked));

  let lastError = '';
  const render = () => {
    const has = player.queue.length > 0;
    empty.hidden = has;
    now.hidden = !has;
    volume.value = String(player.volume);
    loop.checked = player.loop;
    const playing = player.isPlaying;
    play.classList.toggle('is-playing', playing);
