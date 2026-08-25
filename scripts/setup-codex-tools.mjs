import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const exe = (name) => isWindows ? `${name}.cmd` : name;

function run(command, args, { allowFailure = false } = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(exe(command), args, {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: false,
  });
  if (result.error) {
    if (allowFailure) {
      console.warn(`Skipped: ${result.error.message}`);
      return false;
    }
    throw result.error;
  }
  if (result.status !== 0) {
    if (allowFailure) return false;
    process.exit(result.status ?? 1);
  }
  return true;
}

console.log('Setting up Steel Produkt Codex tools...');

run('npx', ['-y', 'ruflo@3.38.19', 'init', '--yes']);

// Refresh MCP registrations so pinned versions are used.
run('codex', ['mcp', 'remove', 'playwright'], { allowFailure: true });
run('codex', ['mcp', 'add', 'playwright', 'npx', '@playwright/mcp@0.0.79']);

run('codex', ['mcp', 'remove', 'ruflo'], { allowFailure: true });
run('codex', ['mcp', 'add', 'ruflo', '--', 'npx', '-y', 'ruflo@3.38.19', 'mcp', 'start']);

// Doctor can report optional-provider warnings; do not undo a successful MCP setup for those.
run('npx', ['-y', 'ruflo@3.38.19', 'doctor'], { allowFailure: true });

console.log('\nDone. Restart Codex or start a new session so MCP servers and project instructions are reloaded.');
