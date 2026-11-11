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
