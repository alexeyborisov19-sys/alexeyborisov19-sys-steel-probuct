"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

type Vec3 = readonly [number, number, number];
export type BasketInteractiveGeometry = {
  envelope: { width: number; height: number; depth: number };
  triangles: readonly { points: readonly [Vec3, Vec3, Vec3]; part: string }[];
  edges?: readonly (readonly [Vec3, Vec3])[];
};
export type BasketInteractiveCamera = { yaw: number; pitch: number; zoom: number };
type PreparedGeometry = { faces: Float32Array; edges: Float32Array; center: Vec3; half: Vec3 };
const INITIAL: BasketInteractiveCamera = { yaw: -.52, pitch: -.3, zoom: 1 };

export function normalizeBasketInteractiveCamera(camera: BasketInteractiveCamera): BasketInteractiveCamera {
  const yaw = Number.isFinite(camera.yaw) ? camera.yaw : INITIAL.yaw;
  return {
    yaw: ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI,
    pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, Number.isFinite(camera.pitch) ? camera.pitch : INITIAL.pitch)),
    zoom: Math.max(.65, Math.min(1.8, Number.isFinite(camera.zoom) ? camera.zoom : 1)),
  };
}

/** Broad edge taps offer single-pointer rotation without a separate toolbar. */
export function basketInteractiveTapCamera(camera: BasketInteractiveCamera, x: number, y: number): BasketInteractiveCamera | null {
  if (![x, y].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) return null;
  const horizontal = x - .5, vertical = y - .5;
  if (Math.max(Math.abs(horizontal), Math.abs(vertical)) < .25) return null;
  return normalizeBasketInteractiveCamera({
    ...camera,
    ...(Math.abs(horizontal) >= Math.abs(vertical)
      ? { yaw: camera.yaw + Math.sign(horizontal) * .2 }
      : { pitch: camera.pitch + Math.sign(vertical) * .2 }),
  });
}

export function basketInteractiveRgb(colour: string): [number, number, number] {
  const safe = /^#[a-f\d]{6}$/i.test(colour) ? colour : '#46505a';
  return [1, 3, 5].map(start => parseInt(safe.slice(start, start + 2), 16) / 255) as [number, number, number];
}

/** Decode the display colour once; all surface illumination is linear-light. */
export function basketInteractiveLinearRgb(colour: string): [number, number, number] {
  return basketInteractiveRgb(colour).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4) as [number, number, number];
}

/** Appearance-only buffers. They never provide a manufacturing blank or a thickness. */
export function prepareBasketInteractiveGeometry(geometry: BasketInteractiveGeometry): PreparedGeometry | null {
  if (!Object.values(geometry.envelope).every(v => Number.isFinite(v) && v > 0 && v <= 10000)
    || !geometry.triangles.length || geometry.triangles.length > 60000 || (geometry.edges?.length ?? 0) > 120000) return null;
  const faces: number[] = [], edges: number[] = [];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const valid = (p: Vec3) => p.length === 3 && p.every(v => Number.isFinite(v) && Math.abs(v) <= 20000);
  for (const { points } of geometry.triangles) {
    if (points.length !== 3 || !points.every(valid)) return null;
    const [a, b, c] = points;
    const u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...normal);
    if (length < 1e-10) continue;
    for (const point of points) {
      faces.push(...point, ...normal.map(n => n / length));
      point.forEach((n, i) => { min[i] = Math.min(min[i], n); max[i] = Math.max(max[i], n); });
    }
  }
  if (!faces.length) return null;
  for (const edge of geometry.edges ?? []) {
    if (edge.length !== 2 || !edge.every(valid)) return null;
    edges.push(...edge[0], ...edge[1]);
  }
  return {
    faces: new Float32Array(faces), edges: new Float32Array(edges),
    center: min.map((n, i) => (n + max[i]) / 2) as unknown as Vec3,
    half: min.map((n, i) => (max[i] - n) / 2) as unknown as Vec3,
  };
}

/** Orthographic orbit: near/far stay physical; fitting uses the same immutable envelope. */
export function basketInteractiveCameraMatrix(mesh: PreparedGeometry, input: BasketInteractiveCamera, aspect: number) {
  const camera = normalizeBasketInteractiveCamera(input);
  const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw), cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
  const rotation = [cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy];
  const projectedHalf = [0, 1, 2].map(row => mesh.half.reduce((sum, n, column) => sum + Math.abs(rotation[column * 3 + row]) * n, 0));
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const extent = Math.max(projectedHalf[1], projectedHalf[0] / ratio, 1) / .82;
  const scale = [camera.zoom / (extent * ratio), camera.zoom / extent, .9 / Math.max(Math.hypot(...mesh.half), 1)];
  const matrix = new Float32Array(16);
  for (let column = 0; column < 3; column++) for (let row = 0; row < 3; row++) matrix[column * 4 + row] = rotation[column * 3 + row] * scale[row];
  for (let row = 0; row < 3; row++) matrix[12 + row] = -mesh.center.reduce((sum, n, column) => sum + n * matrix[column * 4 + row], 0);
  matrix[15] = 1;
  return { matrix, normalMatrix: new Float32Array(rotation) };
}

function fallbackPath(mesh: PreparedGeometry) {
  const { matrix } = basketInteractiveCameraMatrix(mesh, INITIAL, 900 / 560);
  const project = (offset: number) => {
    const [x, y, z] = mesh.edges.slice(offset, offset + 3);
    return `${((matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] + 1) * 450).toFixed(2)},${((1 - matrix[1] * x - matrix[5] * y - matrix[9] * z - matrix[13]) * 280).toFixed(2)}`;
  };
  const result: string[] = [];
  for (let i = 0; i < mesh.edges.length; i += 6) result.push(`M${project(i)}L${project(i + 3)}`);
  return result.join('');
}

const VERTEX = `attribute vec3 position; attribute vec3 normal; uniform mat4 camera; uniform mat3 normalCamera;
varying vec3 surfaceNormal; void main(){ gl_Position=camera*vec4(position,1.0); surfaceNormal=normalCamera*normal; }`;
const FRAGMENT = `precision mediump float; varying vec3 surfaceNormal; uniform vec3 paint; uniform float edgeMode;
float encodeSrgb(float value){return value<=.0031308?12.92*value:1.055*pow(value,1.0/2.4)-.055;}
vec3 displayColour(vec3 linear){vec3 v=clamp(linear,0.0,1.0);return vec3(encodeSrgb(v.r),encodeSrgb(v.g),encodeSrgb(v.b));}
void main(){
  if(edgeMode>.5){gl_FragColor=vec4(displayColour(mix(paint*.72,vec3(.38,.46,.52),.22)),1.0);return;}
  vec3 n=normalize(surfaceNormal); if(n.z>0.0)n=-n;
  float key=max(dot(n,normalize(vec3(.25,.65,-.72))),0.0);
  float fill=max(dot(n,normalize(vec3(.75,.1,-.65))),0.0);
  vec3 powder=paint*(.58+.62*key+.14*fill);
  gl_FragColor=vec4(displayColour(powder),1.0);
}`;

export function BasketInteractiveView({ geometry, colour, description, dimensionLabel = 'Ширина × высота × глубина' }: { geometry: BasketInteractiveGeometry; colour: string; description?: string; dimensionLabel?: string }) {
  const uid = useId();
  const mesh = useMemo(() => prepareBasketInteractiveGeometry(geometry), [geometry]);
  const staticPath = useMemo(() => mesh ? fallbackPath(mesh) : '', [mesh]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const camera = useRef<BasketInteractiveCamera>({ ...INITIAL });
  const paint = useRef(colour);
  const runtime = useRef<{ draw: () => void } | null>(null);
  const frame = useRef<number | null>(null);
  const reduced = useRef(false);
  const pointer = useRef<{ id: number; x: number; y: number; startX: number; startY: number; touch: boolean; active: boolean } | null>(null);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const [contextRevision, setContextRevision] = useState(0);
  const [dragging, setDragging] = useState(false);

  function cancelFrame() { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; }
  function redraw() {
    cancelFrame();
    frame.current = requestAnimationFrame(() => { frame.current = null; runtime.current?.draw(); });
  }

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reduced.current = preference.matches;
      if (preference.matches && frame.current !== null) cancelFrame();
    };
    update(); preference.addEventListener('change', update);
    return () => { preference.removeEventListener('change', update); };
  }, []);
  useEffect(() => { paint.current = colour; runtime.current?.draw(); }, [colour]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !mesh) return;
    let gl: WebGLRenderingContext | null;
    try { gl = element.getContext('webgl', { alpha: true, antialias: true, depth: true, preserveDrawingBuffer: false }); }
    catch { gl = null; }
    if (!gl) { setReady(false); setFailed(true); return; }
    const shaders: WebGLShader[] = [], buffers: WebGLBuffer[] = [];
    let program: WebGLProgram | null = null, observer: ResizeObserver | null = null;
    let lost = false;
    const onLost = (event: Event) => { event.preventDefault(); lost = true; cancelFrame(); runtime.current = null; setReady(false); setFailed(true); };
    const onRestored = () => setContextRevision(n => n + 1);
    element.addEventListener('webglcontextlost', onLost);
    element.addEventListener('webglcontextrestored', onRestored);
    try {
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type); if (!shader) throw new Error('Shader unavailable');
        shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader failed');
        return shader;
      };
      program = gl.createProgram(); if (!program) throw new Error('Program unavailable');
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT)); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Program failed');
      const position = gl.getAttribLocation(program, 'position'), normal = gl.getAttribLocation(program, 'normal');
      const cameraLocation = gl.getUniformLocation(program, 'camera'), normalLocation = gl.getUniformLocation(program, 'normalCamera');
      const paintLocation = gl.getUniformLocation(program, 'paint'), edgeLocation = gl.getUniformLocation(program, 'edgeMode');
      const upload = (data: Float32Array) => {
        const buffer = gl.createBuffer(); if (!buffer) throw new Error('Buffer unavailable');
        buffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return buffer;
      };
      const faces = upload(mesh.faces);
      const draw = () => {
        if (lost || !program) return;
        gl.useProgram(program);
        const { matrix, normalMatrix } = basketInteractiveCameraMatrix(mesh, camera.current, element.width / element.height);
        gl.uniformMatrix4fv(cameraLocation, false, matrix); gl.uniformMatrix3fv(normalLocation, false, normalMatrix);
        gl.uniform3fv(paintLocation, basketInteractiveLinearRgb(paint.current));
        gl.viewport(0, 0, element.width, element.height); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
        gl.bindBuffer(gl.ARRAY_BUFFER, faces); gl.enableVertexAttribArray(position); gl.enableVertexAttribArray(normal);
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 24, 12);
        gl.uniform1f(edgeLocation, 0);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1); gl.drawArrays(gl.TRIANGLES, 0, mesh.faces.length / 6); gl.disable(gl.POLYGON_OFFSET_FILL);
        element.dataset.camera = `${camera.current.yaw.toFixed(3)},${camera.current.pitch.toFixed(3)},${camera.current.zoom.toFixed(3)}`;
      };
      runtime.current = { draw };
      const resize = () => {
        const rect = element.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2, 1536 / Math.max(rect.width, rect.height, 1));
        const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
        if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
        draw();
      };
      resize();
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Render failed');
      observer = new ResizeObserver(resize); observer.observe(element);
      setReady(true); setFailed(false);
    } catch { runtime.current = null; setReady(false); setFailed(true); }
    return () => {
      cancelFrame(); runtime.current = null; observer?.disconnect();
      element.removeEventListener('webglcontextlost', onLost); element.removeEventListener('webglcontextrestored', onRestored);
      for (const buffer of buffers) gl.deleteBuffer(buffer);
      for (const shader of shaders) gl.deleteShader(shader);
      if (program) gl.deleteProgram(program);
    };
  }, [mesh, contextRevision]);

  function change(delta: Partial<BasketInteractiveCamera>) {
    camera.current = normalizeBasketInteractiveCamera({ ...camera.current, ...delta });
    redraw();
  }
  function reset() {
    const next = { ...INITIAL };
    cancelFrame();
    if (reduced.current) { camera.current = next; runtime.current?.draw(); return; }
    const previous = { ...camera.current }, started = performance.now();
    const turn = normalizeBasketInteractiveCamera({ ...previous, yaw: next.yaw - previous.yaw }).yaw;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / 180), ease = 1 - (1 - progress) ** 3;
      camera.current = normalizeBasketInteractiveCamera({ yaw: previous.yaw + turn * ease, pitch: previous.pitch + (next.pitch - previous.pitch) * ease, zoom: previous.zoom + (1 - previous.zoom) * ease });
      runtime.current?.draw();
      frame.current = progress < 1 ? requestAnimationFrame(animate) : null;
    };
    frame.current = requestAnimationFrame(animate);
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!ready) return;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => change({ yaw: camera.current.yaw - .12 }), ArrowRight: () => change({ yaw: camera.current.yaw + .12 }),
      ArrowUp: () => change({ pitch: camera.current.pitch - .12 }), ArrowDown: () => change({ pitch: camera.current.pitch + .12 }),
      '+': () => change({ zoom: camera.current.zoom + .1 }), '=': () => change({ zoom: camera.current.zoom + .1 }),
      '-': () => change({ zoom: camera.current.zoom - .1 }), Home: reset,
    };
    if (moves[event.key]) { event.preventDefault(); moves[event.key](); }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!ready || !event.isPrimary || event.button !== 0) return;
    cancelFrame();
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, touch: event.pointerType === 'touch', active: false };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    if (!current.active) {
      const x = Math.abs(event.clientX - current.startX), y = Math.abs(event.clientY - current.startY);
      if (current.touch && y > x && y > 6) { pointer.current = null; return; }
      if (Math.max(x, y) < 6) return;
      current.active = true; event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
    }
    change({ yaw: camera.current.yaw + (event.clientX - current.x) * .008, pitch: camera.current.pitch + (current.touch ? 0 : (event.clientY - current.y) * .008) });
    current.x = event.clientX; current.y = event.clientY;
  }
  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    const tapped = !current.active && Math.max(Math.abs(event.clientX - current.startX), Math.abs(event.clientY - current.startY)) < 6;
    pointerEnd(event);
    if (!tapped) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const next = basketInteractiveTapCamera(camera.current, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
    if (next) change(next);
  }

  if (!mesh) return <p role="status" className="border border-slate-300 p-4 text-sm text-slate-700">Не удалось показать геометрию. Проверьте размеры корзины.</p>;
  return <section data-basket-interactive-view className="overflow-hidden border border-[#33434d] bg-[#11191e] text-[#eef2f4]" aria-label="Объёмный вид корзины">
    <div className="relative h-[320px] overflow-hidden sm:h-[420px] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#ff7017]" role="group" aria-label="Вращение модели" aria-describedby={`${uid}-help`} tabIndex={ready ? 0 : -1}
      style={{ touchAction: 'pan-y pinch-zoom', cursor: ready ? dragging ? 'grabbing' : 'grab' : 'default', background: 'radial-gradient(ellipse at 40% 30%, #283640 0%, #11191e 72%)' }}
      onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} onDoubleClick={() => { if (ready) reset(); }}>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[8%] left-[15%] h-[15%] w-[70%] rounded-[50%]" style={{ background: 'radial-gradient(ellipse, #0009 0%, #0000 70%)' }}/>
      <canvas ref={canvas} aria-hidden="true" data-basket-depth-renderer={ready ? 'ready' : 'unavailable'} className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: ready ? 1 : 0 }}/>
      {!ready && <svg data-basket-static-fallback role="img" aria-label="Резервный каркас корзины: задние рёбра также видны" viewBox="0 0 900 560" className="pointer-events-none absolute inset-0 h-full w-full" style={{ maxHeight: 'none' }}><path d={staticPath} fill="none" stroke="#9aabb5" strokeWidth="1"/></svg>}
      <p className="pointer-events-none absolute bottom-3 left-4 right-4 text-center text-[11px] text-[#b6c1c8]" aria-hidden="true">{ready ? 'Вращайте модель мышкой или пальцем' : failed ? 'Статичный каркас · 3D недоступен' : 'Подготовка объёмного вида'}</p>
    </div>
    <div className="space-y-3 border-t border-[#33434d] px-3 py-3 sm:px-4">
      <p id={`${uid}-help`} className="sr-only">{description ? `${description}. ` : ''}Коснитесь края: слева и справа для поворота, сверху и снизу для наклона. Стрелки вращают модель, плюс и минус меняют масштаб, Home или двойной щелчок возвращает исходный вид. Вертикальный жест прокручивает страницу.</p>
      <div><p className="text-xs text-[#b6c1c8]">{dimensionLabel}</p><p className="mt-1 text-sm font-semibold tabular-nums">{geometry.envelope.width.toLocaleString('ru-RU')} × {geometry.envelope.height.toLocaleString('ru-RU')} × {geometry.envelope.depth.toLocaleString('ru-RU')} мм</p></div>
      <p className="text-xs leading-5 text-[#b6c1c8]">Визуализация, не рабочий чертёж. Цвет на экране приблизительный.</p>
      {failed && <p role="status" className="text-xs leading-5 text-[#f6c394]">3D недоступен. Показан статичный каркас, включая задние рёбра; параметры корзины сохранены.</p>}
    </div>
  </section>;
}
