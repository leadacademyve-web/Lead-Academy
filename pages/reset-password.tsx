import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const hash = window.location.hash || '';
      if (hash.includes('access_token') || hash.includes('refresh_token')) {
        await supabase.auth.getSession();
      }
      if (active) setReady(true);
    }

    loadSession();
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setLoading(false);
      return setError('La contraseña debe tener al menos 6 caracteres.');
    }

    if (password !== confirmPassword) {
      setLoading(false);
      return setError('Las contraseñas no coinciden.');
    }

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      return setError(error.message || 'No se pudo actualizar la contraseña.');
    }

    setSuccess('Tu contraseña fue actualizada. Ahora puedes iniciar sesión.');
    setTimeout(() => router.push('/login'), 1200);
  }

  return (
    <main className="auth-wrap auth-wrap-premium">
      <section className="auth-premium-card">
        <div className="auth-premium-form">
          <div className="auth-brand-block">
            <div
              style={{
                width: 150,
                height: 150,
                flex: '0 0 150px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src="/Logo.png"
                alt="Lead Academy"
                className="auth-logo-image"
                style={{
                  width: 150,
                  height: 150,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
            <div>
              <div className="auth-brand-title">Lead Academy Corporation</div>
              <div className="auth-brand-sub">Trading & Investing</div>
            </div>
          </div>

          <h1>Restablecer contraseña</h1>
          <p className="helper">Escribe tu nueva contraseña para terminar el proceso.</p>

          {!ready ? (
            <p className="helper">Preparando formulario...</p>
          ) : (
            <form onSubmit={onSubmit}>
              <label className="label">
                Nueva contraseña
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className="label">
                Confirmar contraseña
                <input
                  className="input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              <div className="auth-premium-actions">
                <button className="btn btn-primary auth-main-button" disabled={loading} type="submit">
                  {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>

                <div className="auth-secondary-row">
                  <Link href="/login" className="btn btn-secondary">Volver al login</Link>
                  <Link href="/" className="btn btn-ghost">Inicio</Link>
                </div>
              </div>

              {error && <p className="error">{error}</p>}
              {success && <p className="success">{success}</p>}
            </form>
          )}
        </div>

        <div className="auth-premium-image">
          <img src="/wall-street-bull.jpg" alt="Wall Street Bull" />
          <div className="auth-image-shade" />
          <div className="auth-image-overlay">
            <strong>OPERACIONES EN VIVO</strong>
            <span>NYSE • NASDAQ • S&amp;P500 • RUSSELL • DOW JONES • OPCIONES</span>
          </div>
        </div>
      </section>
    </main>
  );
}
