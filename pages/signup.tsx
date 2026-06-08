import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/src/lib/supabaseClient';
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY_CODE, findCountryByCode } from '@/src/lib/countries';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedCountry = findCountryByCode(countryCode);

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

    const digitsOnlyPhone = phone.replace(/\D/g, '');

    if (!digitsOnlyPhone) {
      setLoading(false);
      return setError('Debes ingresar tu número telefónico.');
    }

    if (digitsOnlyPhone.length < 7 || digitsOnlyPhone.length > 15) {
      setLoading(false);
      return setError('Ingresa un número telefónico válido para el país seleccionado.');
    }

    if (password.length < 6) {
      setLoading(false);
      return setError('La contraseña debe tener al menos 6 caracteres.');
    }

    if (password !== confirmPassword) {
      setLoading(false);
      return setError('Las contraseñas no coinciden.');
    }

    const normalizedPhone = `${countryCode}${digitsOnlyPhone}`;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/email-confirmed` : undefined,
        data: {
          full_name: fullName.trim(),
          phone: normalizedPhone,
          sms_opt_in: smsOptIn,
          sms_opt_in_at: smsOptIn ? new Date().toISOString() : null,
        },
      },
    });

    setLoading(false);

    const message = String(error?.message || '').toLowerCase();
    if (
      error ||
      message.includes('already registered') ||
      message.includes('already exists') ||
      (data?.user && Array.isArray((data.user as any).identities) && (data.user as any).identities.length === 0)
    ) {
      if (message.includes('already registered') || message.includes('already exists') || (data?.user && Array.isArray((data.user as any).identities) && (data.user as any).identities.length === 0)) {
        return setError('Este correo ya está registrado.');
      }

      return setError(error?.message || 'No se pudo crear la cuenta.');
    }

    setSuccess('Cuenta creada. Revisa tu correo y confirma tu email antes de iniciar sesión.');
    setFullName('');
    setCountryCode(DEFAULT_COUNTRY_CODE);
    setPhone('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSmsOptIn(false);
  }

  return (
    <main className="auth-wrap auth-wrap-premium">
      <section className="auth-premium-card">
        <div className="auth-premium-form" style={{ paddingTop: 34, paddingBottom: 34 }}>
          <div className="auth-brand-block" style={{ marginBottom: 18 }}>
            <div
              style={{
                width: 92,
                height: 72,
                flex: '0 0 92px',
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
              <div className="auth-brand-sub">Trading &amp; Investing</div>
            </div>
          </div>

          <h1 style={{ marginBottom: 14 }}>Crear cuenta</h1>
          <p className="helper" style={{ marginBottom: 0 }}>
            Tu acceso al portal se activará cuando tu suscripción esté activa.
          </p>

          <form onSubmit={onSubmit} style={{ marginTop: 22 }}>
            <label className="label" style={{ marginBottom: 12, gap: 8 }}>
              Nombre completo
              <input
                className="input"
                style={{ minHeight: 48 }}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>

            <label className="label" style={{ marginBottom: 12, gap: 8 }}>
              Número telefónico
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10 }}>
                <select
                  className="input"
                  style={{ minHeight: 48 }}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  aria-label="Código de país"
                >
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  className="input"
                  style={{ minHeight: 48 }}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
                  autoComplete="tel-national"
                  inputMode="numeric"
                  placeholder={selectedCountry.placeholder}
                  required
                />
              </div>
              <p className="helper" style={{ marginTop: 8, marginBottom: 0 }}>
                Se guardará en formato internacional, por ejemplo: {selectedCountry.code}{selectedCountry.placeholder}
              </p>
            </label>

            <label style={{ display: 'flex', gap: 10, marginTop: 4, marginBottom: 12, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
                style={{ marginTop: 4 }}
              />
              <span className="helper" style={{ margin: 0 }}>
                Acepto recibir notificaciones SMS de Lead Academy Corporation relacionadas con mi cuenta, acceso al portal, operaciones en vivo, seminarios, clases, pagos, programación de eventos y actualizaciones importantes. Pueden aplicar tarifas de mensajes y datos. Responde STOP para cancelar o HELP para obtener ayuda.
              </span>
            </label>

            <label className="label" style={{ marginBottom: 12, gap: 8 }}>
              Correo electrónico
              <input
                className="input"
                style={{ minHeight: 48 }}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="label" style={{ marginBottom: 12, gap: 8 }}>
                Contraseña
                <input
                  className="input"
                  style={{ minHeight: 48 }}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className="label" style={{ marginBottom: 12, gap: 8 }}>
                Confirmar contraseña
                <input
                  className="input"
                  style={{ minHeight: 48 }}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>

            <div className="auth-premium-actions" style={{ marginTop: 16, gap: 10 }}>
              <button className="btn btn-primary auth-main-button" style={{ minHeight: 54 }} disabled={loading} type="submit">
                {loading ? 'Creando...' : 'Crear cuenta'}
              </button>

              <div className="auth-secondary-row">
                <Link href="/login" className="btn btn-secondary">Ya tengo cuenta</Link>
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
