// Builds the family app for the web (the Expo app in mobile/) and puts it in
// Next's public/ folder, so the portal serves it at its root: families get the
// same screens on the web, on a phone browser and in the iOS/Android app.
// The school admin (/s/<school>/admin), sign-in and the API stay in Next.
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const mobile = path.join(root, 'mobile');
const out = path.join(root, 'public');
const run = (cmd, cwd) => execSync(cmd, { stdio: 'inherit', cwd, env: { ...process.env, EXPO_PUBLIC_API_URL: '' } });

if (!existsSync(path.join(mobile, 'node_modules'))) run('npm ci --no-audit --no-fund', mobile);
rmSync(out, { recursive: true, force: true });
run(`npx expo export -p web --output-dir "${out}"`, mobile);
if (!existsSync(path.join(out, 'index.html'))) throw new Error('The app export did not produce public/index.html.');
console.log('Family app exported to public/.');
