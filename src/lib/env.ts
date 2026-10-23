type RuntimeEnv = Partial<Pick<ImportMetaEnv, 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY' | 'VITE_API'>>;

declare global {
  interface Window {
    RUNTIME_ENV?: RuntimeEnv;
  }
}

const runtime: RuntimeEnv = (typeof window !== 'undefined' && window.RUNTIME_ENV) || {};

function pick<K extends keyof RuntimeEnv>(key: K): RuntimeEnv[K] {
  return runtime[key] || import.meta.env[key];
}

export const env = {
  VITE_SUPABASE_URL: pick('VITE_SUPABASE_URL'),
  VITE_SUPABASE_ANON_KEY: pick('VITE_SUPABASE_ANON_KEY'),
  VITE_API: pick('VITE_API'),
};
