// Vinext beta.5 calls process.exit(0) immediately after prerendering. On
// Windows this races native Vite worker cleanup and crashes in libuv.
// Allow successful builds to drain naturally; preserve every failure exit.
import { fileURLToPath } from 'node:url';

if (process.platform === 'win32') {
  const exit = process.exit.bind(process);
  process.exit = (code = 0) => {
    if (Number(code) === 0) {
      process.exitCode = 0;
      return;
    }
    exit(code);
  };
}
const cli = new URL('./cli.js', import.meta.resolve('vinext'));
process.argv = [
  process.execPath,
  fileURLToPath(cli),
  'build',
  ...process.argv.slice(2),
];
await import(cli.href);
