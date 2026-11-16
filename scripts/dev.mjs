import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import concurrently from 'concurrently';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = ['--yes', 'supabase@3.1.0', '--workdir', root];
const localApi = 'http://127.0.0.1:54321';
const baseline = '20261115224928_f03_additive_generic_wish_records.sql';
const managementMigration = '20261115234000_f03_003_jinn_management.sql';
const firstValueMigration = '20261116040000_f03_004_verified_first_value.sql';
const checkOnly = process.argv.includes('--check');

function supabase(...args) {
  return execFileSync('npx', [...cli, ...args], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
  });
}

function readLocalRow(sql) {
  let output;
  try {
    output = supabase('db', 'query', '--read-only', '-o', 'json', sql);
  } catch (error) {
    const detail = String(error?.stderr || error?.message || 'Unknown CLI error')
      .replace(/(postgres(?:ql)?:\/\/)[^\s@]+@/gi, '$1[redacted]@')
      .replace(/sb_(secret|publishable)_[\w-]+/g, 'sb_$1_[redacted]')
      .trim().split('\n').slice(-4).join(' ').slice(0, 800);
    throw new Error('Local Supabase database query failed: ' + detail +
      '. Check Docker and run: npx supabase@3.1.0 status');
  }
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error('Supabase CLI returned non-JSON data for the local schema check. ' +
      'Run: npx supabase@3.1.0 db query "select 1 as ready" --read-only -o json');
  }
  const rows = Array.isArray(parsed) ? parsed : (parsed?.rows ?? parsed?.result?.rows ?? parsed?.data);
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error('Unexpected Supabase CLI JSON result; expected a rows array. ' +
      'Run: npx supabase@3.1.0 db query "select 1 as ready" --read-only -o json');
  }
  return rows[0];
}

function checkSchema() {
  return readLocalRow(`
    select
      to_regclass('public.jinns') is not null as jinns,
      to_regclass('public.wish_records') is not null as wish_records,
      to_regclass('public.deeds') is not null as deeds,
      to_regclass('public.artifacts') is not null as artifacts,
      to_regprocedure('public.create_wish_with_deed(uuid,text,jsonb,jsonb)') is not null as save_rpc,
      (select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'wish_records'
          and column_name in ('original_intent','state','updated_at')) = 3 as wish_records_columns,
      (select count(*)::int from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')) as public_relations,
      to_regclass('supabase_migrations.schema_migrations') is not null as has_history,
      case when to_regclass('public.wish_records') is not null
        then has_column_privilege('authenticated','public.wish_records','primary_jinn_id','UPDATE')
        else false end as jinn_assignment,
      exists (select 1 from pg_policies where schemaname='public' and tablename='jinns'
        and policyname='owner deletes empty non-primary jinns') as jinn_deletion,
      to_regprocedure('public.create_verified_first_value(uuid,uuid,text,jsonb,jsonb)') is not null as trusted_first_value,
      case when to_regprocedure('public.create_wish_with_deed(uuid,text,jsonb,jsonb)') is not null
        then not has_function_privilege('authenticated',
          'public.create_wish_with_deed(uuid,text,jsonb,jsonb)','EXECUTE')
        else false end as client_first_save_revoked
  `);
}

function missingSchema(schema) {
  return Object.entries({
    'public.jinns': schema.jinns,
    'public.wish_records': schema.wish_records,
    'public.deeds': schema.deeds,
    'public.artifacts': schema.artifacts,
    'create_wish_with_deed RPC': schema.save_rpc,
    'F03 Wish columns': schema.wish_records_columns,
    'F03-003 Wish assignment grant': schema.jinn_assignment,
    'F03-003 safe Jinn deletion policy': schema.jinn_deletion,
    'F03-004 server-only first save': schema.trusted_first_value,
    'F03-004 old client receipt path revoked': schema.client_first_save_revoked,
  }).filter(([, present]) => present !== true).map(([name]) => name);
}

function verifyLocalSchema() {
  const schema = checkSchema();
  const missing = missingSchema(schema);
  if (!missing.length) return;

  if (schema.public_relations !== 0) {
    throw new Error(`Local Supabase is missing: ${missing.join(', ')}. This can happen if the local DB was created from the older F03 branch. Existing local data was NOT modified. Inspect with npx supabase@3.1.0 migration list, or explicitly reset ONLY the disposable local stack after backing up anything you need. Do not run db reset --remote.`);
  }
  const migrations = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(file => file.endsWith('.sql'));
  const pristineHistory = schema.has_history === false || (schema.has_history === true &&
    readLocalRow('select count(*)::int as entries from supabase_migrations.schema_migrations').entries === 0);
  if (!pristineHistory || migrations.length !== 3 || ![baseline, managementMigration, firstValueMigration].every(file => migrations.includes(file))) {
    throw new Error(`The local F03 schema is incomplete. Missing: ${missing.join(', ')}. Review the local migration history before applying any changes.`);
  }
  if (checkOnly) throw new Error('Local Supabase is empty. Run npm run dev to apply the F03 baseline.');

  console.info('[Wisht] Applying the three additive F03 migrations only to a verified empty local database.');
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
  const serviceKey = settings.SECRET_KEY || settings.SERVICE_ROLE_KEY;
  if (API_URL !== localApi || !PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
    throw new Error(`Expected the local Wisht Supabase API at ${localApi} with a publishable key.`);
  }
  verifyLocalSchema();
  // Both child processes receive the same local pair, even if the shell exported hosted settings.
  if(!serviceKey||serviceKey.length<32)throw new Error('Local Supabase service key is missing; secure first-value saving cannot start.');
  return { VITE_SUPABASE_URL: API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey };
}

try {
  const env = localSupabaseEnv();
  console.info(`[Wisht] F03 schema verified at ${localApi}. Local sign-in codes: http://127.0.0.1:54324/`);
  if (!checkOnly) {
    const { SUPABASE_SERVICE_ROLE_KEY, ...browserEnv } = env;
    const { result } = concurrently([
      { name: 'api', command: 'npm run dev -w api', prefixColor: 'blue',
        env: { ...browserEnv, SUPABASE_SERVICE_ROLE_KEY }, cwd: root },
      { name: 'web', command: 'npm run dev -w web', prefixColor: 'magenta',
        env: browserEnv, cwd: root },
    ], { killOthersOn: ['failure', 'success'] });
    await result.catch(() => { process.exitCode = 1; });
  }
} catch (error) {
  console.error(`[Wisht] ${error.message}`);
  process.exitCode = 1;
}
