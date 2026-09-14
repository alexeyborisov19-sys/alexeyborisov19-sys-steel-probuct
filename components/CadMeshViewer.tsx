"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { CadMeshPrimitive } from "@/lib/instant-quote/cad-model";
import { calculateMeshBounds, calculateTriangleNormals, countMeshTriangles } from "@/lib/instant-quote/mesh";

type ViewerMode = "solid" | "wireframe";

type Mat4 = Float32Array;

function identity(): Mat4 {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let value = 0;
      for (let k = 0; k < 4; k++) value += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = value;
    }
  }
  return out;
}

function translation(x: number, y: number, z: number): Mat4 {
  const out = identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function rotationX(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

function rotationY(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function perspective(fovRadians: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovRadians / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / Math.max(aspect, 0.001), 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function normalMatrixFromModel(model: Mat4) {
  // Viewer model contains only rotation + translation, so the upper-left 3x3 is already orthonormal.
  return new Float32Array([
    model[0], model[1], model[2],
    model[4], model[5], model[6],
    model[8], model[9], model[10],
  ]);
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Не удалось создать WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Ошибка компиляции WebGL shader.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
    precision highp float;
    layout(location = 0) in vec3 aPosition;
    layout(location = 1) in vec3 aNormal;
    uniform mat4 uMvp;
    uniform mat3 uNormalMatrix;
    out vec3 vNormal;
    out vec3 vPosition;
    void main() {
      vNormal = normalize(uNormalMatrix * aNormal);
      vPosition = aPosition;
      gl_Position = uMvp * vec4(aPosition, 1.0);
    }
  `);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    in vec3 vNormal;
    in vec3 vPosition;
    uniform vec3 uBaseColor;
    uniform bool uWireframe;
    out vec4 outColor;
    void main() {
      vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
      float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
      float rim = pow(1.0 - abs(normalize(vNormal).z), 2.0);
      vec3 color = uWireframe
        ? uBaseColor
        : uBaseColor * (0.28 + diffuse * 0.72) + vec3(0.12) * rim;
      outColor = vec4(color, 1.0);
    }
  `);
  const program = gl.createProgram();
  if (!program) throw new Error("Не удалось создать WebGL program.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Ошибка линковки WebGL program.";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function buildWireframeIndices(indices: number[]) {
  const edges = new Set<string>();
  const out: number[] = [];
  const add = (a: number, b: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = `${lo}:${hi}`;
    if (edges.has(key)) return;
    edges.add(key);
    out.push(lo, hi);
  };
  for (let index = 0; index + 2 < indices.length; index += 3) {
    const a = indices[index];
    const b = indices[index + 1];
    const c = indices[index + 2];
    add(a, b);
    add(b, c);
    add(c, a);
  }
  return out;
}

type GpuMesh = {
  vao: WebGLVertexArrayObject;
  triangleCount: number;
  wireCount: number;
  triangleIndexBuffer: WebGLBuffer;
  wireIndexBuffer: WebGLBuffer;
};

export function CadMeshViewer({ meshes, className = "" }: { meshes: CadMeshPrimitive[]; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const yawRef = useRef(-0.7);
  const pitchRef = useRef(0.55);
  const zoomRef = useRef(1);
  const dragRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const [mode, setMode] = useState<ViewerMode>("solid");
  const [error, setError] = useState<string | null>(null);
  const bounds = useMemo(() => calculateMeshBounds(meshes), [meshes]);
  const triangleCount = useMemo(() => countMeshTriangles(meshes), [meshes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bounds || meshes.length === 0) return;
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: true });
    if (!gl) {
      setError("WebGL2 недоступен в этом браузере.");
      return;
    }

    let program: WebGLProgram | null = null;
    const gpuMeshes: GpuMesh[] = [];
    let frame = 0;

    try {
      program = createProgram(gl);
      const mvpLocation = gl.getUniformLocation(program, "uMvp");
      const normalLocation = gl.getUniformLocation(program, "uNormalMatrix");
      const colorLocation = gl.getUniformLocation(program, "uBaseColor");
      const wireLocation = gl.getUniformLocation(program, "uWireframe");

      for (const mesh of meshes) {
        const vao = gl.createVertexArray();
        const positionBuffer = gl.createBuffer();
        const normalBuffer = gl.createBuffer();
        const triangleIndexBuffer = gl.createBuffer();
        const wireIndexBuffer = gl.createBuffer();
        if (!vao || !positionBuffer || !normalBuffer || !triangleIndexBuffer || !wireIndexBuffer) {
          throw new Error("Не удалось выделить WebGL buffers.");
        }

        const normals = mesh.normals?.length === mesh.positions.length ? mesh.normals : calculateTriangleNormals(mesh);
        const wireIndices = buildWireframeIndices(mesh.indices);

        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.positions), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mesh.indices), gl.STATIC_DRAW);
        gl.bindVertexArray(null);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(wireIndices), gl.STATIC_DRAW);

        gpuMeshes.push({
          vao,
          triangleCount: mesh.indices.length,
          wireCount: wireIndices.length,
          triangleIndexBuffer,
          wireIndexBuffer,
        });
      }

      const render = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const displayHeight = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
        }

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.025, 0.035, 0.04, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.useProgram(program);

        const radius = bounds.radius;
        const cameraDistance = Math.max(radius * 3.1 * zoomRef.current, 1);
        const projection = perspective(Math.PI / 4, canvas.width / canvas.height, Math.max(radius / 100, 0.01), cameraDistance + radius * 8);
        const center = translation(-bounds.center[0], -bounds.center[1], -bounds.center[2]);
        const rotation = multiply(rotationX(pitchRef.current), rotationY(yawRef.current));
        const view = translation(0, 0, -cameraDistance);
        const modelView = multiply(view, multiply(rotation, center));
        const mvp = multiply(projection, modelView);

        gl.uniformMatrix4fv(mvpLocation, false, mvp);
        gl.uniformMatrix3fv(normalLocation, false, normalMatrixFromModel(rotation));
        const wire = mode === "wireframe";
        gl.uniform1i(wireLocation, wire ? 1 : 0);
        gl.uniform3f(colorLocation, wire ? 0.96 : 0.95, wire ? 0.51 : 0.42, wire ? 0.13 : 0.08);

        for (const gpuMesh of gpuMeshes) {
          gl.bindVertexArray(gpuMesh.vao);
          if (wire) {
            gl.disable(gl.CULL_FACE);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpuMesh.wireIndexBuffer);
            gl.drawElements(gl.LINES, gpuMesh.wireCount, gl.UNSIGNED_INT, 0);
          } else {
            gl.enable(gl.CULL_FACE);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpuMesh.triangleIndexBuffer);
            gl.drawElements(gl.TRIANGLES, gpuMesh.triangleCount, gl.UNSIGNED_INT, 0);
          }
        }
        gl.bindVertexArray(null);
        frame = requestAnimationFrame(render);
      };

      frame = requestAnimationFrame(render);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ошибка 3D viewer.");
    }

    return () => {
      cancelAnimationFrame(frame);
      for (const gpuMesh of gpuMeshes) {
        gl.deleteBuffer(gpuMesh.triangleIndexBuffer);
        gl.deleteBuffer(gpuMesh.wireIndexBuffer);
        gl.deleteVertexArray(gpuMesh.vao);
      }
      if (program) gl.deleteProgram(program);
    };
  }, [bounds, meshes, mode]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    yawRef.current += dx * 0.008;
    pitchRef.current = Math.max(-1.45, Math.min(1.45, pitchRef.current + dy * 0.008));
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const onWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    zoomRef.current = Math.max(0.35, Math.min(4, zoomRef.current * Math.exp(event.deltaY * 0.0012)));
  };

  const resetView = () => {
    yawRef.current = -0.7;
    pitchRef.current = 0.55;
    zoomRef.current = 1;
  };

  if (!bounds || meshes.length === 0) {
    return <div className={`flex h-full items-center justify-center text-xs text-white/35 ${className}`}>3D mesh пока отсутствует.</div>;
  }

  return (
    <div className={`relative h-full min-h-[420px] overflow-hidden bg-[#080b0d] ${className}`}>
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        aria-label="Интерактивная 3D-модель детали"
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(245,130,32,0.07),transparent_42%)]" />
      <div className="absolute left-4 top-4 flex gap-1">
        {(["solid", "wireframe"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`border px-3 py-2 text-[9px] font-bold uppercase tracking-[.12em] transition ${mode === item ? "border-steel-orange bg-steel-orange text-black" : "border-white/15 bg-black/55 text-white/50 hover:text-white"}`}
          >
            {item === "solid" ? "Solid" : "Wire"}
          </button>
        ))}
        <button type="button" onClick={resetView} className="border border-white/15 bg-black/55 px-3 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-white/50 hover:text-white">Fit</button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-2 text-[9px] uppercase tracking-[.1em] text-white/40">
        <span className="border border-white/10 bg-black/55 px-2 py-1">{meshes.length} mesh</span>
        <span className="border border-white/10 bg-black/55 px-2 py-1">{triangleCount.toLocaleString("ru-RU")} triangles</span>
        <span className="border border-white/10 bg-black/55 px-2 py-1">{bounds.size.map((value) => Math.round(value * 10) / 10).join(" × ")} мм</span>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 text-right text-[9px] leading-relaxed text-white/28">drag — вращение<br />wheel — масштаб</div>
      {error && <div className="absolute inset-x-4 top-16 border border-red-400/25 bg-black/85 p-3 text-xs text-red-200">{error}</div>}
    </div>
  );
}
