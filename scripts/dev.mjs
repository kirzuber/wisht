import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import concurrently from 'concurrently';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = ['--yes', 'supabase@3.1.0', '--workdir', root];
const localApi = 'http://127.0.0.1:54321';
const baseline = '20261115201523_f03_domain_neutral_baseline.sql';
const checkOnly = process.argv.includes('--check');

function supabase(...args) {
  return execFileSync('npx', [...cli, ...args], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
  });
}

function readLocalRow(sql) {
  try {
    const { rows } = JSON.parse(supabase('db', 'query', '--read-only', '-o', 'json', sql));
    if (!rows?.[0]) throw new Error();
    return rows[0];
  } catch {
    throw new Error('Could not check the local Supabase schema. Verify the local stack is healthy.');
  }
}

function checkSchema() {
  return readLocalRow(`
    select
      to_regclass('public.jinns') is not null as jinns,
      to_regclass('public.deeds') is not null as deeds,
      to_regclass('public.artifacts') is not null as artifacts,
      to_regprocedure('public.create_wish_with_deed(uuid,text,jsonb,jsonb)') is not null as save_rpc,
      (select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'wishes'
          and column_name in ('original_intent','state','updated_at')) = 3 as wish_columns,
      (select count(*)::int from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')) as public_relations,
      to_regclass('supabase_migrations.schema_migrations') is not null as has_history
  `);
}

function missingSchema(schema) {
  return Object.entries({
    'public.jinns': schema.jinns,
    'public.deeds': schema.deeds,
    'public.artifacts': schema.artifacts,
    'create_wish_with_deed RPC': schema.save_rpc,
    'F03 Wish columns': schema.wish_columns,
  }).filter(([, present]) => present !== true).map(([name]) => name);
}

function verifyLocalSchema() {
  const schema = checkSchema();
  const missing = missingSchema(schema);
  if (!missing.length) return;

  if (schema.public_relations !== 0) {
    throw new Error(`Local Supabase has an existing schema and is missing: ${missing.join(', ')}. Preserve the local database and use a fresh F03 stack or a reviewed local migration.`);
  }
  const migrations = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(file => file.endsWith('.sql'));
  const pristineHistory = schema.has_history === false || (schema.has_history === true &&
    readLocalRow('select count(*)::int as entries from supabase_migrations.schema_migrations').entries === 0);
  if (!pristineHistory || migrations.length !== 1 || migrations[0] !== baseline) {
    throw new Error(`The local F03 schema is incomplete. Missing: ${missing.join(', ')}. Review the local migration history before applying any changes.`);
  }
  if (checkOnly) throw new Error('Local Supabase is empty. Run npm run dev to apply the F03 baseline.');

  console.info('[Wisht] Applying the F03 baseline to the empty local database.');
  try {
    supabase('migration', 'up');
  } catch {
    throw new Error('Could not apply the F03 baseline locally. Run npx supabase@3.1.0 migration list to inspect migration history.');
  }
  const stillMissing = missingSchema(checkSchema());
  if (stillMissing.length) throw new Error(`Local F03 migration did not create: ${stillMissing.join(', ')}.`);
}

function localSupabaseEnv() {
  let settings;
  try {
    settings = parseEnv(supabase('status', '-o', 'env'));
  } catch {
    throw new Error('Cannot read local Supabase status. Start Docker and run npx supabase@3.1.0 start.');
  }
  const { API_URL, PUBLISHABLE_KEY } = settings;
  if (API_URL !== localApi || !PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
    throw new Error(`Expected the local Wisht Supabase API at ${localApi} with a publishable key.`);
  }
  verifyLocalSchema();
  // Both child processes receive the same local pair, even if the shell exported hosted settings.
  return { VITE_SUPABASE_URL: API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY };
}

try {
  const env = localSupabaseEnv();
  console.info(`[Wisht] F03 schema verified at ${localApi}. Local sign-in codes: http://127.0.0.1:54324/`);
  if (!checkOnly) {
    const { result } = concurrently([
      { name: 'api', command: 'npm run dev -w api', prefixColor: 'blue', env, cwd: root },
      { name: 'web', command: 'npm run dev -w web', prefixColor: 'magenta', env, cwd: root },
    ], { killOthersOn: ['failure', 'success'] });
    await result.catch(() => { process.exitCode = 1; });
  }
} catch (error) {
  console.error(`[Wisht] ${error.message}`);
  process.exitCode = 1;
}
