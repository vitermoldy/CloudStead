import { Emitter, clamp } from '../core/emitter';
import { load, save } from '../core/store';
import { parseLink, loadYouTubeApi, fetchDetails, ERROR_TEXT, LinkError, type ParsedLink, type YTPlayer } from './links';

export interface QueueItem extends ParsedLink {
  id: string;
  title: string;
  author: string;
  thumb: string;
  status: 'ready' | 'error';
