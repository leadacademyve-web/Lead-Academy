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
    <main className="auth-wrap">
      <div className="auth-card">
        <h1>Recuperar contraseña</h1>
        <p className="helper">Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.</p>

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

          <div className="actions">
            <button className="btn btn-primary" disabled={loading} type="submit">
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
            <Link href="/login" className="btn btn-secondary">Volver</Link>
          </div>

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
        </form>
      </div>
    </main>
  );
}
