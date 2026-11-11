import '@fontsource-variable/funnel-display';
import '@fontsource-variable/funnel-sans';
import './style.css';

import { Ambient } from './audio/ambient';
import { reducedMotion } from './core/emitter';
import { exportSave, isReadOnly, lastSaved, load, onSaved, parseSaveFile, replaceAll, save, SaveFileError, setReadOnly } from './core/store';
import { MusicPlayer } from './music/player';
import { clockText, FocusTimer, type PresetId } from './sim/focus';
import { formatMinutes, formatMinutesLong, MILESTONES, tilesFor, TOTAL_MINUTES, type Milestone } from './sim/milestones';
import { Progress } from './sim/progress';
import { PROP_TITLE } from './scene/props';
import type { Hover, TimeMode, World as WorldType } from './scene/world';
import { Cursor } from './ui/cursor';
import { mountMusicUi } from './ui/music-ui';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const html = document.documentElement;

// ------------------------------------------------------------ preview mode (?pratinjau=menit)
const params = new URLSearchParams(location.search);
const previewRaw = params.get('pratinjau');
const previewMinutes = previewRaw !== null && /^\d{1,5}$/.test(previewRaw) ? Math.min(Number(previewRaw), TOTAL_MINUTES + 60) : null;
if (previewMinutes !== null) setReadOnly(true);

// ------------------------------------------------------------ state
const progress = new Progress(previewMinutes);
const ambient = new Ambient();
const timer = new FocusTimer((ms) => progress.add(ms), () => progress.finishSession(), previewMinutes === null);
const player = new MusicPlayer($('player-host'));
const settings = load<{ time: TimeMode; paused: boolean | null }>('settings', { time: 'senja', paused: null });

// ------------------------------------------------------------ small helpers
const toastEl = $('toast');
let toastTimer = 0;
function toast(text: string, ms = 3200): void {
  toastEl.textContent = text;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('is-on'), ms);
}

const bubble = $('bubble');
const say = $('say');
let bubbleUntil = 0;
function speak(text: string, ms = 2800): void {
  bubble.textContent = text;
  bubble.classList.add('is-on');
  say.textContent = `${progress.name}: ${text}`;
  bubbleUntil = performance.now() + ms;
  positionBubble();
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const clockNow = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });


// ------------------------------------------------------------ the world
const canvas = $<HTMLCanvasElement>('scene');
let world: WorldType | null = null;
const cursor = new Cursor($('cursor'), canvas);
let justBuilt: { text: string; until: number } | null = null;

async function startWorld(): Promise<void> {
  const { World } = await import('./scene/world');
  if (!World.supported()) {
    $('fallback').hidden = false;
    return;
  }
  try {
    world = new World(canvas, { small: Math.min(innerWidth, innerHeight) < 700 });
  } catch {
    $('fallback').hidden = false;
    return;
  }
  const w = world;
  // Development only: a handle for the headless checks.
  if (import.meta.env.DEV) Object.assign(window, { __cs: { world: w, progress, timer, player } });
  w.character.name = progress.name;
  w.sync(new Set(progress.reached().map((m) => m.id)));
  w.setTime(settings.time);
  w.setInstant(reducedMotion());
  w.resetView();
  w.setInkSource(() => [$('big').getBoundingClientRect()]);
  w.setMusic(player.isPlaying);
  w.setContext(progress.todayMinutes, progress.minutes);
  syncWork();

  w.on('ink', (avg: number) => {
    // Cream until the scene behind the clock gets bright; dark ink keeps 3:1 or better there.
    $('big').dataset.ink = avg > 0.17 ? 'dark' : 'light';
  });
  w.on('hover', (h: Hover & { dragging?: boolean }, petting: boolean) => onHover(h, petting));
  w.on('greet', onGreet);
  w.on('pet', (on: boolean) => {
    if (on) {
      speak(pick(['Hehe, geli.', 'Makasih.', 'Enak juga dielus begini.']));
      ambient.greet();
    }
  });
  w.on('woke', () => speak('Eh, aku ketiduran.'));
  w.on('poke-prop', onPokeProp);
  w.on('poke-tile', () => undefined);
  w.on('beat', (kind: 'hammer' | 'dig' | 'water' | 'haul') => ambient.work(kind));
  w.on('pop', () => ambient.pop());
  w.on('land', () => ambient.land());
  w.on('built', (m: Milestone) => {
    justBuilt = { text: m.done, until: performance.now() + 9000 };
    toast(m.done);
    speak(pick(['Selesai!', 'Jadi juga.', 'Bagus, kan?']), 2200);
    ambient.chime();
    renderHud(true);
    renderIsland();
  });
  greetBtn.hidden = false;
  w.onFrame = () => {
    positionGreet();
    if (bubbleUntil) positionBubble();
  };

  const paused = settings.paused ?? reducedMotion();
  setScenePaused(paused, false);
  if (!paused) w.start();
  requestAnimationFrame(() => html.classList.add('scene-ready'));
  // Once the island has faded in over it, the still is no longer needed.
  setTimeout(() => {
    $('poster').hidden = true;
  }, 1200);
  document.fonts?.ready.then(() => w.frame());
}

/** The resident works while a focus block runs, rests in a break, and lives on the island otherwise. */
function syncWork(): void {
  if (!world) return;
  world.setWork(timer.focusing ? 'work' : timer.resting ? 'rest' : 'free');
  world.setProgress(progress.next(), projectShare());
}

/** How far the current project has got, 0 to 1. */
function projectShare(): number {
  const next = progress.next();
  if (!next) return 1;
  const from = progress.previousMinutes();
  return Math.max(0, Math.min(1, (progress.minutes - from) / (next.minutes - from)));
}

// ------------------------------------------------------------ cursor and the resident
function onHover(h: Hover & { dragging?: boolean }, petting: boolean): void {
  hoveringResident = h.kind === 'char' || petting;
  if (h.dragging) return cursor.set('grab');
  if (petting) return cursor.set('pet', 'Elus');
  switch (h.kind) {
    case 'char': {
      const sleeping = world?.character.act === 'sleep';
      cursor.set('char', sleeping ? 'Bangunkan' : `Sapa ${progress.name}`);
      break;
    }
    case 'prop':
      cursor.set('prop', h.prop?.title ?? '');
      break;
    case 'ghost': {
      const m = world?.ghostMilestone;
      cursor.set('ghost', m ? `Petak baru · ${formatMinutesLong(m.minutes - progress.minutes)} lagi` : 'Petak baru');
      break;
    }
    case 'tile':
      cursor.set('tile');
      break;
    default:
      cursor.set('idle');
  }
}

function onGreet(): void {
  if (!world) return;
  const c = world.character;
  if (c.act === 'sleep') {
    world.nudge();
    return;
  }
  const next = progress.next();
  const left = next ? formatMinutesLong(next.minutes - progress.minutes) : '';
  const pct = Math.floor(projectShare() * 100);
  if (timer.focusing) {
    c.wave();
    speak(pick(next ? [
      `Lagi kerja, nih. ${next.title} sudah ${pct}%.`,
