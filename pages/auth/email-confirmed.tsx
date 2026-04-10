import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';

export default function EmailConfirmedPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await supabase.auth.signOut();
      } catch {}

      if (!active) return;

      setTimeout(() => {
        router.replace('/login?email_changed=1');
      }, 1800);
    }

    run();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background:
          'linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1120 100%)',
        padding: '24px',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          borderRadius: 24,
          padding: '36px 30px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(10px)',
          textAlign: 'center',
          color: '#ffffff',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 20px',
            borderRadius: '999px',
            display: 'grid',
            placeItems: 'center',
            background:
              'linear-gradient(135deg, rgba(34,197,94,0.22), rgba(59,130,246,0.22))',
            border: '1px solid rgba(255,255,255,0.14)',
            fontSize: 34,
          }}
        >
          ✅
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 12,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.72)',
          }}
        >
          Confirmación exitosa
        </p>

        <h1
          style={{
            margin: '12px 0 14px',
            fontSize: 'clamp(30px, 5vw, 42px)',
            lineHeight: 1.08,
            fontWeight: 800,
          }}
        >
          Tu correo fue confirmado correctamente
        </h1>

        <p
          style={{
            margin: '0 auto',
            maxWidth: 420,
            fontSize: 17,
            lineHeight: 1.65,
            color: 'rgba(255,255,255,0.84)',
          }}
        >
          Cerrando tu sesión actual y redirigiendo al inicio de sesión...
        </p>
      </div>
    </main>
  );
}