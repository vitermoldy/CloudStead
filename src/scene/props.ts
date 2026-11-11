import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry,
  CylinderGeometry, DodecahedronGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group, IcosahedronGeometry,
  LatheGeometry, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry,
  PointLight, Shape, ShaderMaterial, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector2, Vector3, type Raycaster,
} from 'three';
import { rng } from '../core/emitter';
import { cellKey, type Cell, type PropKind } from '../sim/milestones';

export interface PropContext {
  night: number;
  time: number;
  todayMinutes: number;
  totalMinutes: number;
}

export interface PropEntry {
