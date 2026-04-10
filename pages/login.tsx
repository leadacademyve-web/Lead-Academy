import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';
import { registerSingleSession } from '@/src/lib/singleSession';

export default function LoginPage() {
  const router = useRouter();
  const next = typeof router.query.next === 'string' ? router.query.next : '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      const message = (error.message || '').toLowerCase();
      if (message.includes('email not confirmed')) {
        return setError('Debes confirmar tu correo antes de iniciar sesión.');
      }
      if (message.includes('invalid login credentials')) {
        return setError('Correo o contraseña incorrectos.');
      }
      return setError(error.message || 'No se pudo iniciar sesión.');
    }

    if (!data.user) {
      return setError('No se pudo recuperar tu usuario.');
    }

    await registerSingleSession(data.user.id);
    router.push(next);
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <h1>Iniciar sesión</h1>
        <p className="helper">Accede con tu correo y contraseña para entrar al portal privado.</p>

        <form onSubmit={onSubmit}>
          <label className="label">
            Correo electrónico
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="label">
            Contraseña
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <div style={{ marginTop: 12, marginBottom: 18 }}>
            <Link href="/forgot-password" className="helper" style={{ textDecoration: 'underline' }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <div className="actions">
            <button className="btn btn-primary" disabled={loading} type="submit">
              {loading ? 'Ingresando...' : 'Entrar'}
            </button>
            <Link href="/signup" className="btn btn-secondary">Crear cuenta</Link>
          </div>

          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </main>
  );
}
