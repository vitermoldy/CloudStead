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

