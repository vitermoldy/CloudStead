import {
  CircleGeometry, Color, DataTexture, DoubleSide, Group, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter,
  Mesh, PlaneGeometry, RGBAFormat, ShaderMaterial, Vector3, type Camera,
} from 'three';
import { rng } from '../core/emitter';
import type { LiveLook } from './palette';

const VARIANTS = 4;
const CELL = 256;

/**
 * Four cumulus heads drawn once into an atlas. Each is a union of spheres on a flat base; the
