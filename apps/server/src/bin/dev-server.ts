import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

type ProcessVersionsWithBun = NodeJS.ProcessVersions & {
  bun?: string;
};

const bunVersion = (process.versions as ProcessVersionsWithBun).bun;
const bunExecutable = process.execPath;
const serverRoot = process.cwd();
const distDir = path.join(serverRoot, 'dist');
const serverEntrypoint = path.join(distDir, 'main.js');
const restartDelayMs = 700;
const pollIntervalMs = 400;

let compilerProcess: ChildProcess | undefined;
let serverProcess: ChildProcess | undefined;
let shutdownStarted = false;
let knownDistMtimeMs = 0;
let restartTimer: NodeJS.Timeout | undefined;
let restartQueue = Promise.resolve();
let runtimeRestartInProgress = false;

if (!bunVersion) {
  console.error('Tabliodb server dev mode must be started with Bun. Use: bun run dev:server');
  process.exit(1);
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  await shutdown(1);
});

async function main(): Promise<void> {
  registerShutdownHandlers();

  // Build once before the watcher starts so the first spawned app process never runs stale or missing JavaScript.
  await runInitialBuild();
  knownDistMtimeMs = readLatestJavaScriptMtimeMs(distDir);
  startServerRuntime();
  startCompilerWatch();
  startDistPoller();
}

async function runInitialBuild(): Promise<void> {
  await runBunCommand(['x', 'nest', 'build'], 'Initial Nest build failed');
}

function startCompilerWatch(): void {
  compilerProcess = spawnBun(['x', 'nest', 'build', '--watch']);

  compilerProcess.once('exit', (code, signal) => {
    if (shutdownStarted) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`Nest build watcher stopped unexpectedly with ${reason}.`);
    void shutdown(code && code > 0 ? code : 1);
  });
}

function startServerRuntime(): void {
  if (!existsSync(serverEntrypoint)) {
    throw new Error(`Compiled server entrypoint was not found at ${serverEntrypoint}`);
  }

  // The runtime process is intentionally Bun, even during development, so Bun-only incompatibilities appear early.
  serverProcess = spawnBun([serverEntrypoint], {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
  });

  serverProcess.once('exit', (code, signal) => {
    if (shutdownStarted || runtimeRestartInProgress) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`Tabliodb server runtime stopped unexpectedly with ${reason}.`);
    void shutdown(code && code > 0 ? code : 1);
  });
}

function startDistPoller(): void {
  setInterval(() => {
    if (shutdownStarted) {
      return;
    }

    const latestMtimeMs = readLatestJavaScriptMtimeMs(distDir);

    if (latestMtimeMs <= knownDistMtimeMs) {
      return;
    }

    knownDistMtimeMs = latestMtimeMs;
    scheduleRuntimeRestart();
  }, pollIntervalMs).unref();
}

function scheduleRuntimeRestart(): void {
  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  // TypeScript emits several files per build; debouncing avoids restarting Bun against a half-written dist folder.
  restartTimer = setTimeout(() => {
    restartQueue = restartQueue.then(restartServerRuntime);
  }, restartDelayMs);
}

async function restartServerRuntime(): Promise<void> {
  if (shutdownStarted) {
    return;
  }

  console.log('Restarting Tabliodb server with Bun...');
  runtimeRestartInProgress = true;
  try {
    await stopChildProcess(serverProcess);
    startServerRuntime();
  } finally {
    runtimeRestartInProgress = false;
  }
}

function readLatestJavaScriptMtimeMs(directory: string): number {
  if (!existsSync(directory)) {
    return 0;
  }

  let latestMtimeMs = 0;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      latestMtimeMs = Math.max(latestMtimeMs, readLatestJavaScriptMtimeMs(entryPath));
      continue;
    }

    // Only JavaScript output drives runtime behavior; source maps changing alone should not restart the app.
    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }

    latestMtimeMs = Math.max(latestMtimeMs, statSync(entryPath).mtimeMs);
  }

  return latestMtimeMs;
}

async function runBunCommand(args: string[], failureMessage: string): Promise<void> {
  const child = spawnBun(args);
  const exitCode = await waitForExit(child);

  if (exitCode !== 0) {
    throw new Error(`${failureMessage}. Exit code: ${exitCode}`);
  }
}

function spawnBun(args: string[], extraEnv: NodeJS.ProcessEnv = {}): ChildProcess {
  return spawn(bunExecutable, args, {
    cwd: serverRoot,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: 'inherit',
    windowsHide: true,
  });
}

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 0);
    });
  });
}

async function stopChildProcess(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null) {
    return;
  }

  const exited = waitForExit(child);
  child.kill('SIGTERM');
  await Promise.race([exited, delay(2_500)]);

  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await Promise.race([exited, delay(1_000)]);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function registerShutdownHandlers(): void {
  process.once('SIGINT', () => {
    void shutdown(0);
  });

  process.once('SIGTERM', () => {
    void shutdown(0);
  });
}

async function shutdown(exitCode: number): Promise<void> {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;

  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  await Promise.all([stopChildProcess(serverProcess), stopChildProcess(compilerProcess)]);
  process.exit(exitCode);
}
