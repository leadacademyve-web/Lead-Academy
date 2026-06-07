import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/src/lib/supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    setLoading(false);

    if (error) {
      return setError(error.message || 'No se pudo enviar el correo de recuperación.');
    }

    setSuccess('Te enviamos un correo con el enlace para restablecer tu contraseña.');
  }

  return (
    <main className="auth-wrap auth-wrap-premium">
      <section className="auth-premium-card">
        <div className="auth-premium-form">
          <div className="auth-brand-block">
            <img
              src="/logo.png"
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

          <h1>Recuperar contraseña</h1>
          <p className="helper">
            Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
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

            <div className="auth-premium-actions">
              <button className="btn btn-primary auth-main-button" disabled={loading} type="submit">
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>

              <div className="auth-secondary-row">
                <Link href="/login" className="btn btn-secondary">Volver al login</Link>
                <Link href="/" className="btn btn-ghost">Inicio</Link>
              </div>
            </div>

            {error && <p className="error">{error}</p>}
            {success && <p className="success">{success}</p>}
          </form>
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
