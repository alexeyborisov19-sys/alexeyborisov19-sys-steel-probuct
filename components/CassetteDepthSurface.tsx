"use client";
import { useEffect, useRef, useState } from 'react';
import { cassetteInspectionColour, type CassetteInspectionPolygon } from '@/lib/bim/cassette-inspection';

/** Native depth-buffered opaque mesh; no source vertex, topology or IFC mutation. */
export function CassetteDepthSurface({ polygons, colour, onAvailability }: { polygons: CassetteInspectionPolygon[]; colour: string; onAvailability: (ready: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [available, setAvailable] = useState(false);
  const [contextRevision, setContextRevision] = useState(0);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let gl: WebGLRenderingContext | null;
    try { gl = element.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true }); }
    catch { setAvailable(false); onAvailability(false); return; }
    if (!gl) { onAvailability(false); return; }
    const shaders: WebGLShader[] = [];
    const buffers: WebGLBuffer[] = [];
    let program: WebGLProgram | null = null;
    const shader = (type: number, source: string) => {
      const result = gl.createShader(type);
      if (!result) throw new Error('Shader unavailable');
      shaders.push(result); gl.shaderSource(result, source); gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error('Shader compile failed');
      return result;
    };
    const lost = (event: Event) => { event.preventDefault(); setAvailable(false); onAvailability(false); };
    const restored = () => setContextRevision(value => value + 1);
    element.addEventListener('webglcontextlost', lost);
    element.addEventListener('webglcontextrestored', restored);
    try {
      program = gl.createProgram();
      if (!program) throw new Error('Program unavailable');
      gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec3 position; attribute vec3 colour; varying lowp vec3 shade; void main(){ gl_Position=vec4(position,1.0); shade=colour; }'));
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, 'precision mediump float; varying lowp vec3 shade; void main(){ gl_FragColor=vec4(shade,1.0); }'));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Program link failed');
      gl.useProgram(program);
      let min = Infinity, max = -Infinity;
      for (const poly of polygons) for (const point of poly.points) { min = Math.min(min, point[2]); max = Math.max(max, point[2]); }
      const extent = Math.max(1, max - min);
      const vertex = (point: number[], rgb: number[]) => [point[0] / 450 - 1, 1 - point[1] / 280, ((point[2] - min) / extent - .5) * 1.8, ...rgb];
      const faces: number[] = [], edges: number[] = [];
      for (const poly of polygons) {
        const rgb = (cassetteInspectionColour(colour, poly.light).match(/\d+/g) ?? ['168','181','185']).map(value => Number(value) / 255);
        for (let i = 1; i + 1 < poly.points.length; i++) faces.push(...vertex(poly.points[0], rgb), ...vertex(poly.points[i], rgb), ...vertex(poly.points[i + 1], rgb));
        for (const edge of poly.edges) {
          const edgeColour = edge.silhouette ? [33/255,55/255,65/255] : rgb.map((channel, i) => channel * .45 + [38/255,61/255,71/255][i] * .55);
          edges.push(...vertex(edge.points[0], edgeColour), ...vertex(edge.points[1], edgeColour));
        }
      }
      const draw = (data: number[], mode: number) => {
        const buffer = gl.createBuffer(); if (!buffer) throw new Error('Buffer unavailable');
        buffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        for (const [name, offset] of [['position',0],['colour',12]] as const) {
          const attribute = gl.getAttribLocation(program!, name); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 24, offset);
        }
        gl.drawArrays(mode, 0, data.length / 6);
      };
      gl.viewport(0, 0, element.width, element.height);
      gl.clearColor(0,0,0,0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1,1); draw(faces, gl.TRIANGLES); gl.disable(gl.POLYGON_OFFSET_FILL);
      draw(edges, gl.LINES);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Preview rendering failed');
      setAvailable(true); onAvailability(true);
    } catch { setAvailable(false); onAvailability(false); }
    return () => { element.removeEventListener('webglcontextlost', lost); element.removeEventListener('webglcontextrestored', restored); for (const buffer of buffers) gl.deleteBuffer(buffer); for (const item of shaders) gl.deleteShader(item); if (program) gl.deleteProgram(program); };
  }, [polygons, colour, onAvailability, contextRevision]);
  return <foreignObject x="0" y="0" width="900" height="560" style={{ pointerEvents: 'none' }} aria-hidden="true"><canvas ref={canvas} width="1350" height="840" data-depth-renderer={available ? 'ready' : 'unavailable'} style={{ width: '100%', height: '100%', display: available ? 'block' : 'none' }} /></foreignObject>;
}
