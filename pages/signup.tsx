import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/src/lib/supabaseClient';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!fullName.trim()) {
      setLoading(false);
      return setError('Debes ingresar tu nombre completo.');
    }

    if (!email.trim()) {
      setLoading(false);
      return setError('Debes ingresar tu correo electrónico.');
    }

    if (password.length < 6) {
      setLoading(false);
      return setError('La contraseña debe tener al menos 6 caracteres.');
    }

    if (password !== confirmPassword) {
      setLoading(false);
      return setError('Las contraseñas no coinciden.');
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
        },
      },
    });

    setLoading(false);

    if (error) {
      return setError(error.message || 'No se pudo crear la cuenta.');
    }

    setSuccess('Cuenta creada. Revisa tu correo y confirma tu email antes de iniciar sesión.');
    setFullName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <h1>Crear cuenta</h1>
        <p className="helper">Tu acceso al portal se activará cuando tu suscripción esté activa.</p>

        <form onSubmit={onSubmit}>
          <label className="label">
            Nombre completo
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>

          <label className="label">
            Número telefónico
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+1 786 557 1816"
              required
            />
          </label>

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

          <div className="actions">
            <button className="btn btn-primary" disabled={loading} type="submit">
              {loading ? 'Creando...' : 'Crear cuenta'}
            </button>
            <Link href="/login" className="btn btn-secondary">Ya tengo cuenta</Link>
          </div>

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
        </form>
      </div>
    </main>
  );
}
