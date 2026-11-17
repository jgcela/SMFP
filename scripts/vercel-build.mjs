// Vercel runs this instead of `next build` (package.json "vercel-build").
// Production deploys apply pending database migrations and the idempotent seed
// (plans, the St. Mary school and, when SEED_OWNER_* are set, its first owner),
// so nobody has to run them by hand after merging.
// Preview deploys do the same only when DB_SETUP_ON_PREVIEW=true, which must be
// set together with a preview DATABASE_URL that points at a separate database
// (a Neon branch), never at production's.
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

const env = process.env.VERCEL_ENV ?? 'unset';
const setUpDb = env === 'production' || (env === 'preview' && process.env.DB_SETUP_ON_PREVIEW === 'true');
if (setUpDb) {
  if (!process.env.DATABASE_URL) throw new Error(`DATABASE_URL is missing in the Vercel ${env} environment.`);
  console.log('Applying database migrations…');
  run('npx tsx scripts/migrate.ts');
  console.log('Seeding plans and the school (skips what exists)…');
  run('npx tsx scripts/seed.ts');
} else {
  console.log(`Skipping database setup (VERCEL_ENV=${env}).`);
}
run('node scripts/build-app-web.mjs');
run('npx next build');
