import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import concurrently from 'concurrently';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = ['--yes', 'supabase@3.1.0', '--workdir', root];
const localApi = 'http://127.0.0.1:54321';

function supabase(...args) {
  return execFileSync('npx', [...cli, ...args], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
  });
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

  let ready;
  try {
    const { rows } = JSON.parse(supabase('db', 'query', '--read-only', '-o', 'json', `
      select (
        to_regclass('public.jinns') is not null
        and to_regclass('public.deeds') is not null
        and to_regclass('public.artifacts') is not null
        and to_regprocedure('public.create_wish_with_deed(uuid,text,jsonb,jsonb)') is not null
        and (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'wishes'
            and column_name in ('original_intent','state','updated_at')) = 3
      ) as ready
    `));
    ready = rows?.[0]?.ready === true;
  } catch {
    throw new Error('Could not check the local Supabase schema. Verify the local stack is healthy.');
  }
  if (!ready) throw new Error('The local database is missing the F03 schema. See Local development in README.md.');

  // Both child processes receive the same local pair, even if the shell exported hosted settings.
  return { VITE_SUPABASE_URL: API_URL, VITE_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY };
}

try {
  const env = localSupabaseEnv();
  console.info(`[Wisht] F03 schema verified at ${localApi}. Local sign-in codes: http://127.0.0.1:54324/`);
  const { result } = concurrently([
    { name: 'api', command: 'npm run dev -w api', prefixColor: 'blue', env, cwd: root },
    { name: 'web', command: 'npm run dev -w web', prefixColor: 'magenta', env, cwd: root },
  ], { killOthersOn: ['failure', 'success'] });
  await result.catch(() => { process.exitCode = 1; });
} catch (error) {
  console.error(`[Wisht] ${error.message}`);
  process.exitCode = 1;
}
