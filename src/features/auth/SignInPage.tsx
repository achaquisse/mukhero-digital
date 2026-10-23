import { useState } from 'react';
import { z } from 'zod';
import { useApi } from '../../api/context';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Display';
import { TextField } from '../../components/ui/Field';
import { useZodForm } from '../modals/useZodForm';

/** Email + password sign-in is only offered in development. */
const SHOW_DEV_LOGIN = import.meta.env.DEV;

const devLoginSchema = z.object({
  email: z.string().trim().min(1, 'Indique um email').pipe(z.email('Formato de email inválido')),
  password: z.string().min(1, 'Indique a palavra-passe'),
});

export function SignInPage() {
  const api = useApi();
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On success the auth listener updates the session and the guard redirects.
  const onSignIn = async () => {
    if (signing) return;
    setSigning(true);
    setError(null);
    try {
      await api.signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ligar à Google. Tente novamente.');
      setSigning(false);
    }
  };

  return (
    <main className="box-border grid min-h-screen place-items-center p-6">
      <div className="box-border flex w-full max-w-[380px] flex-col items-center gap-6 rounded-[20px] border border-[#E7E9EE] bg-white px-7 pb-7 pt-9 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <Logo size={52} />
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[28px] font-semibold tracking-[-0.03em]">Mukhero Digital</h1>
          <p className="m-0 text-[15px] leading-normal text-pretty text-muted">Valorizamos cada passo da sua jornada.</p>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          aria-busy={signing}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white p-[13px] text-[15px] font-[550] text-ink hover:bg-hover"
        >
          {signing ? (
            <span aria-hidden className="size-4 animate-spin-fast rounded-full border-2 border-line border-t-ink" />
          ) : (
            <GoogleMark />
          )}
          {signing ? 'A ligar à Google…' : 'Continuar com Google'}
        </button>
        {error && (
          <p role="alert" className="m-0 text-[13px] text-danger">
            {error}
          </p>
        )}
        {SHOW_DEV_LOGIN && <DevLogin />}
        <div className="text-xs leading-normal text-muted">
          Ao continuar aceita os{' '}
          <a href="#termos" className="text-brand no-underline hover:text-[#1D4FD8]">
            Termos
          </a>{' '}
          e a{' '}
          <a href="#privacidade" className="text-brand no-underline hover:text-[#1D4FD8]">
            Política de Privacidade
          </a>
          .
        </div>
      </div>
    </main>
  );
}

function DevLogin() {
  const api = useApi();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useZodForm(devLoginSchema, {
    defaultValues: { email: '', password: '' },
  });
  return (
    <form
      noValidate
      aria-label="Entrar com email (desenvolvimento)"
      className="flex w-full flex-col gap-3 border-t border-divider pt-5 text-left"
      onSubmit={handleSubmit(async ({ email, password }) => {
        setError(null);
        try {
          await api.signInWithPassword(email, password);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Erro ao entrar');
        }
      })}
    >
      <span className="text-xs font-[550] uppercase tracking-[0.04em] text-subtle">Desenvolvimento</span>
      <TextField
        label="Email"
        type="email"
        autoComplete="username"
        {...register('email')}
        error={formState.errors.email?.message}
      />
      <TextField
        label="Palavra-passe"
        type="password"
        autoComplete="current-password"
        {...register('password')}
        error={formState.errors.password?.message}
      />
      {error && (
        <p role="alert" className="m-0 text-[13px] text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="block" disabled={formState.isSubmitting}>
        Entrar com email
      </Button>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export default SignInPage;
