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
      `Kamu fokus, aku kerja. ${left} lagi ${next.title.toLowerCase()} jadi.`,
      'Sebentar, tanggung. Lanjut fokus, ya.',
    ] : ['Pulaunya sudah utuh. Aku temani kamu fokus.']));
  } else if (timer.resting) {
    c.wave();
    speak(pick(['Istirahat dulu. Minum air, ya.', 'Regangkan badan sebentar.', 'Matamu juga perlu lepas dari layar.']));
  } else {
    c.wave();
    const lines = ['Hai! Mulai fokus, nanti aku kerja.', 'Aku cuma bisa membangun selama kamu fokus.'];
    if (next && pct > 0) lines.push(`${next.title} baru ${pct}%. Lanjut fokus, yuk.`);
    if (next) lines.push(`${left} fokus lagi, ${next.title.toLowerCase()} jadi.`);
    if (player.isPlaying) lines.push('Musiknya enak. Lanjut belajar?');
    speak(pick(lines));
  }
  ambient.greet();
}

function onPokeProp(e: { kind: keyof typeof PROP_TITLE; title: string }): void {
  const lines: Partial<Record<keyof typeof PROP_TITLE, string>> = {
    rock: 'Batu ini sudah ada sejak hari pertama.',
    pond: 'Airnya dingin.',
    windmill: 'Anginnya kencang di ketinggian.',
    tree: 'Daunnya makin lebat.',
    sapling: 'Masih kecil. Nanti tumbuh rindang.',
    hut: 'Pondoknya hangat kalau malam.',
    board: 'Itu catatan fokusmu hari ini.',
    balloon: 'Suatu hari kita terbang ke pulau lain.',
    telescope: 'Malam nanti kita lihat bintang.',
    garden: 'Sayurnya belum bisa dipanen.',
    pole: 'Kabelnya sampai ke pulau sebelah.',
    lamp: 'Lampunya menyala sendiri tiap senja.',
    bench: 'Tempat bagus untuk melihat awan.',
    pine: 'Cemara ini tahan angin.',
    waterfall: 'Airnya jatuh sampai ke awan.',
    flowers: 'Bunganya ikut bergoyang kena angin.',
  };
  speak(lines[e.kind] ?? `${e.title}.`, 2400);
}

function positionBubble(): void {
  if (!world) {
    bubble.classList.remove('is-on');
    return;
  }
  if (performance.now() > bubbleUntil) {
    bubble.classList.remove('is-on');
    bubbleUntil = 0;
    return;
  }
  const a = world.bubbleAnchor();
  const half = Math.min(120, bubble.offsetWidth / 2);
  bubble.style.left = `${Math.max(half + 12, Math.min(innerWidth - half - 12, a.x))}px`;
  bubble.style.top = `${Math.max(bubble.offsetHeight + 80, a.y)}px`;
}

const greetBtn = $<HTMLButtonElement>('greet');
greetBtn.addEventListener('click', () => onGreet());
let hoveringResident = false;
/** The name tag rides above the head; it steps aside while the resident speaks or the pointer is on them. */
function positionGreet(): void {
  if (!world) return;
  const a = world.bubbleAnchor();
  greetBtn.style.left = `${a.x}px`;
  greetBtn.style.top = `${a.y + 6}px`;
  greetBtn.classList.toggle('is-quiet', !a.visible || bubbleUntil > 0 || hoveringResident);
}
function nameTag(): void {
  $('greet-name').textContent = progress.name;
  greetBtn.setAttribute('aria-label', `Sapa ${progress.name}`);
}
nameTag();

// ------------------------------------------------------------ the heads-up display
const bigEl = $('big');
const digits = [...bigEl.querySelectorAll<HTMLElement>('.big__d')];
let lastDigits = '';
let lastMinuteSr = -1;

function phaseLine(): string {
  const r = `putaran ${timer.round} dari ${timer.config.rounds}`;
  if (!timer.active) return `Siap fokus · ${r}`;
  if (timer.running) return `<strong>${timer.phaseLabel}</strong> · ${r}`;
  return `${timer.phaseLabel} dijeda · ${r}`;
}

function storyLine(): string {
  const n = progress.name;
  if (justBuilt && performance.now() < justBuilt.until) return justBuilt.text;
  const c = world?.character;
  const next = progress.next();
  if (c?.act === 'cheer') return `${n} selesai. Lihat hasilnya.`;
  if (c?.act === 'sleep') return `${n} tertidur. Klik dia untuk membangunkan.`;
  if (timer.focusing) {
    if (!next) return `Pulau sudah utuh. ${n} menemanimu fokus.`;
    if (c?.act === 'carry') return `${n} mengangkut kayu untuk ${next.title.toLowerCase()}.`;
    return `${n} sedang ${next.doing}.`;
  }
  if (timer.resting) return `Istirahat. ${n} ikut duduk${c?.hasGear('mug') ? ' dan minum teh' : ''}, kerjanya lanjut nanti.`;
  if (!next) return 'Pulau sudah utuh. Waktu fokusmu tetap dicatat.';
  const pct = Math.floor(projectShare() * 100);
  if (timer.active) return `Fokus dijeda. ${n} berhenti kerja, ${next.title.toLowerCase()} di ${pct}%.`;
  return pct > 0
    ? `${n} menunggu kamu fokus. ${next.title} berhenti di ${pct}%.`
    : `${n} menunggu kamu fokus. Selama kamu fokus, dia bekerja membangun pulau.`;
}

let lastHud = '';
function renderHud(force = false): void {
  const ms = timer.remaining();
  const text = clockText(ms).replace(':', '');
  if (text !== lastDigits) {
    lastDigits = text;
    digits.forEach((d, i) => {
      d.textContent = text[i] ?? '0';
    });
  }
  bigEl.classList.toggle('is-paused', timer.active && !timer.running);
  const minLeft = Math.ceil(ms / 60000);
  if (minLeft !== lastMinuteSr) {
    lastMinuteSr = minLeft;
    $('timer-sr').textContent = `Sisa ${formatMinutesLong(ms / 60000)} ${timer.phase === 'focus' ? 'fokus' : 'istirahat'}.`;
  }
  document.title = timer.running ? `${clockText(ms)} · ${timer.phaseLabel} · CloudStead` : 'CloudStead: pulau belajar yang tumbuh setiap menit fokus';

  const next = progress.next();
  const key = [timer.running, timer.phase, timer.round, timer.active, Math.floor(progress.minutes * 4), next?.id, world?.character.act, justBuilt?.until, progress.name].join('|');
  if (!force && key === lastHud) return;
  lastHud = key;
  $('phase').innerHTML = phaseLine();
  $('story').textContent = storyLine();
  const fill = $('meter-fill');
  const meter = $('meter');
  if (next) {
    const from = progress.previousMinutes();
    const k = Math.max(0, Math.min(1, (progress.minutes - from) / (next.minutes - from)));
    $('next-label').textContent = timer.focusing ? 'Dikerjakan: ' : 'Berikutnya: ';
    $('next-title').textContent = next.title;
    $('next-left').textContent = `${formatMinutesLong(next.minutes - progress.minutes)} lagi`;
    fill.style.width = `${(k * 100).toFixed(1)}%`;
    meter.setAttribute('aria-valuenow', String(Math.round(k * 100)));
  } else {
    $('next-label').textContent = '';
    $('next-title').textContent = 'Semua sudah dibangun';
    $('next-left').textContent = `total ${formatMinutes(progress.minutes)}`;
    fill.style.width = '100%';
    meter.setAttribute('aria-valuenow', '100');
  }
  const go = $('focus-toggle');
  go.classList.toggle('is-running', timer.running);
  const label = timer.running
    ? (timer.phase === 'focus' ? 'Jeda fokus' : 'Jeda istirahat')
    : timer.active ? (timer.phase === 'focus' ? 'Lanjutkan fokus' : 'Lanjutkan istirahat') : 'Mulai fokus';
  $('focus-toggle-text').textContent = label;
  $('focus-reset').hidden = !timer.active;
  $<HTMLButtonElement>('focus-start').textContent = label;
  $('focus-state').textContent = `Putaran ${timer.round} dari ${timer.config.rounds} · ${timer.active ? (timer.running ? timer.phaseLabel.toLowerCase() + ' berjalan' : timer.phaseLabel.toLowerCase() + ' dijeda') : 'belum dimulai'}`;
}

// ------------------------------------------------------------ focus controls
$('focus-toggle').addEventListener('click', () => toggleFocus());
$('focus-start').addEventListener('click', () => toggleFocus());
$('focus-reset').addEventListener('click', () => timer.reset());
$('focus-reset-2').addEventListener('click', () => timer.reset());
$('focus-skip').addEventListener('click', () => timer.skip());
for (const input of document.querySelectorAll<HTMLInputElement>('#preset-group input')) {
  input.checked = input.value === timer.preset;
  input.addEventListener('change', () => {
    if (input.checked) timer.setPreset(input.value as PresetId);
  });
}

function toggleFocus(): void {
  timer.toggle();
  ambient.start();
