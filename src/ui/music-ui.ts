import { LinkError, SUGGESTIONS } from '../music/links';
import type { MusicPlayer } from '../music/player';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

