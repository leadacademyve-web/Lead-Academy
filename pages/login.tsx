import { FormEvent, useEffect, useState } from 'react';
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

  // 🔥 NUEVO: mostrar mensaje si fue expulsado por otra sesión
  useEffect(() => {
    if (router.query.reason === 'other_device') {
      setError('Tu cuenta fue abierta en otro dispositivo. Por seguridad, cerramos esta sesión.');
    }

    if (router.query.email_changed === '1') {
      setError('Tu correo fue actualizado correctamente. Inicia sesión con tu nuevo email.');
    }
  }, [router.query]);

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
    <main className="auth-wrap auth-wrap-premium">
      <section className="auth-premium-card">
        <div className="auth-premium-form">
          <div className="auth-brand-block">
            <img
              src="/Logo.png"
              alt="Lead Academy"
              className="auth-logo-image"
              style={{
                width: 58,
                height: 58,
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <div>
              <div className="auth-brand-title">Lead Academy Corporation</div>
              <div className="auth-brand-sub">Trading &amp; Investing</div>
            </div>
          </div>

          <h1>Iniciar sesión</h1>
          <p className="helper">
            Accede con tu correo y contraseña para entrar al portal privado.
          </p>

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

            <div className="auth-premium-actions">
              <button className="btn btn-primary auth-main-button" disabled={loading} type="submit">
                {loading ? 'Ingresando...' : 'Entrar'}
              </button>

              <div className="auth-secondary-row">
                <Link href="/signup" className="btn btn-secondary">Crear cuenta</Link>
                <Link href="/" className="btn btn-ghost">Inicio</Link>
              </div>
            </div>

            {error && <p className="error">{error}</p>}
          </form>

          <div className="auth-security-note">
            <span>▱</span>
            <p>Tu información está protegida dentro del portal privado de Lead Academy.
            </p>
          </div>
        </div>
        <div className="auth-premium-image">
          <img
            src="/wall-street-bull.jpg"
            alt="Wall Street Bull"
          />
          <div className="auth-image-shade" />
          <div className="auth-image-overlay">
            <strong>Operaciones en vivo</strong>
            <span>NYSE • NASDAQ • S&amp;P500 • RUSSELL • DOW JONES • OPCIONES</span>
          </div>
        </div>
      </section>
    </main>
  );
}
