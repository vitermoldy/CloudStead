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
