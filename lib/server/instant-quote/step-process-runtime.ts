import { fork } from "node:child_process";
import path from "node:path";
import type { StepKernelPort, StepKernelResult } from "../../instant-quote/step-adapter";

export type IsolatedStepResult = { result: StepKernelResult; surfaceAreaMm2?: number };
export const STEP_PROCESS_TIMEOUT_MS = 90_000;
export const STEP_PROCESS_MAX_INPUT_BYTES = 100 * 1024 * 1024;
const MAX_PENDING_BYTES = 200 * 1024 * 1024;
const MAX_PENDING_JOBS = 100;

/** One native process at a time. Exit, including timeout/crash, releases its entire
 * WASM heap before the next job starts. No model or native kernel is cached. */
export function createStepProcessRuntime(options: { entry: string; timeoutMs?: number; maxPendingBytes?: number; maxPendingJobs?: number }) {
  let pendingBytes = 0, pendingJobs = 0;
  let tail: Promise<unknown> = Promise.resolve();
  const running = new WeakMap<Uint8Array, Promise<IsolatedStepResult>>();

  function execute(bytes: Uint8Array): Promise<IsolatedStepResult> {
    return new Promise((resolve, reject) => {
      const child = fork(options.entry, [], {
        execArgv: [], serialization: "advanced", stdio: ["ignore", "ignore", "ignore", "ipc"],
        env: { PATH: process.env.PATH, NODE_ENV: "production" },
      });
      let result: IsolatedStepResult | undefined;
      let failure: Error | undefined;
      const stop = (message: string) => {
        failure ??= new Error(message);
        child.kill("SIGKILL");
      };
      const timer = setTimeout(() => stop("Время анализа STEP истекло. Попробуйте загрузить деталь отдельно."), options.timeoutMs ?? STEP_PROCESS_TIMEOUT_MS);
      child.on("message", (message: unknown) => {
        if (result || failure) return;
        const value = message as { ok?: boolean; value?: IsolatedStepResult } | null;
        if (!value || value.ok !== true || !value.value?.result || !Array.isArray(value.value.result.meshes)) {
          stop("Не удалось проанализировать STEP. Исходный файл сохранён для проверки инженером.");
          return;
        }
        result = value.value;
      });
      child.on("error", () => stop("Не удалось запустить обработку STEP."));
      child.once("close", (code) => {
        clearTimeout(timer);
        if (failure) reject(failure);
        else if (code !== 0 || !result) reject(new Error("Обработка STEP прервана. Повторите загрузку детали."));
        else resolve(result);
      });
      child.send({ bytes }, error => { if (error) stop("Не удалось передать STEP на обработку."); });
    });
  }

  function read(bytes: Uint8Array): Promise<IsolatedStepResult> {
    const existing = running.get(bytes);
    if (existing) return existing;
    if (!bytes.byteLength || bytes.byteLength > STEP_PROCESS_MAX_INPUT_BYTES) return Promise.reject(new Error("Размер STEP-файла должен быть от 1 байта до 100 МБ."));
    if (pendingJobs >= (options.maxPendingJobs ?? MAX_PENDING_JOBS)
      || pendingBytes + bytes.byteLength > (options.maxPendingBytes ?? MAX_PENDING_BYTES)) {
      return Promise.reject(new Error("Очередь STEP занята. Дождитесь обработки текущих деталей и повторите загрузку."));
    }
    pendingJobs++; pendingBytes += bytes.byteLength;
    const job = tail.then(() => execute(bytes)).finally(() => {
      pendingJobs--; pendingBytes -= bytes.byteLength;
      running.delete(bytes);
    });
    tail = job.then(() => undefined, () => undefined);
    running.set(bytes, job);
    return job;
  }
  return { read };
}

// Next may evaluate this server module in separate route bundles. Share the
// queue across them so a process never runs several native children at once.
const state = globalThis as typeof globalThis & { __steelStepProcessRuntime?: ReturnType<typeof createStepProcessRuntime> };
const runtime = state.__steelStepProcessRuntime ??= createStepProcessRuntime({
  entry: path.join(process.cwd(), process.env.NEXT_DIST_DIR || ".next", "server", "steel-step-worker.cjs"),
});
export const readIsolatedStep = runtime.read;
export const isolatedStepKernel: StepKernelPort = {
  id: "occt-wasm-5-isolated",
  async readStep(bytes) { return (await readIsolatedStep(bytes)).result; },
};
