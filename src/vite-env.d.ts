/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "memory" to run against in-memory demo data instead of Supabase. */
  readonly VITE_API?: 'supabase' | 'memory';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
