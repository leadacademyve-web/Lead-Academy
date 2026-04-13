import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';

export default function EmailConfirmedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Estamos confirmando tu correo electrónico...');

  const nextLoginHref = useMemo(() => {
    const next = typeof router.query.next === 'string' ? router.query.next : '/dashboard';
    return `/login?next=${encodeURIComponent(next)}`;
  }, [router.query.next]);

  useEffect(() => {
    let mounted = true;

    async function confirmEmail() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const errorDescription = url.searchParams.get('error_description');
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token');
        const type = hash.get('type');

        if (errorDescription) {
          throw new Error(errorDescription);
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        if (accessToken || type === 'signup' || code) {
          await supabase.auth.signOut();
          if (!mounted) return;
          setStatus('success');
          setMessage('Tu correo ha sido confirmado exitosamente. Puedes cerrar esta ventana y continuar en el portal.');
          return;
        }

        if (!mounted) return;
        setStatus('success');
        setMessage('Tu correo ya fue confirmado. Puedes cerrar esta ventana y continuar en el portal.');
      } catch (error: any) {
        if (!mounted) return;
        setStatus('error');
        setMessage(error?.message || 'No pudimos confirmar el correo electrónico. Intenta abrir nuevamente el enlace del correo.');
      }
    }

    confirmEmail();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <h1>
          {status === 'loading'
            ? 'Confirmando correo'
            : status === 'success'
              ? 'Correo confirmado'
              : 'No se pudo confirmar'}
        </h1>
        <p className="helper" style={{ marginBottom: 16 }}>
          {message}
        </p>

        {status === 'loading' && (
          <div className="notice">Espere un momento...</div>
        )}
      </div>
    </main>
  );
}
