import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';
import { useAuthUser } from '@/src/context/AuthUserProvider';

export default function Header() {
  const { user, setUser, loading } = useAuthUser();
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  }

  return (
    <header
      className="topbar"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '18px 32px',
        background: '#020617',
        color: 'white',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Link
        href="/"
        className="brand"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          textDecoration: 'none',
          color: 'white',
        }}
      >
        <Image src="/Logo.png" alt="Lead Academy - Trading & Investing" width={26} height={26} />
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Lead Academy - Trading & Investing</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Portal Privado</div>
        </div>
      </Link>

      <nav
        className="topnav"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 14,
        }}
      >
        {loading ? null : user ? (
  <>
    <span style={{ opacity: 0.85 }}>
      👤 {user.user_metadata?.full_name || user.email?.split('@')[0]}
    </span>

    <Link href="/dashboard" style={{ color: 'white', textDecoration: 'none' }}>
      Mi portal
    </Link>

    <button
      onClick={logout}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        fontSize: 14,
        padding: 0,
      }}
    >
      Salir
    </button>
  </>
) : (
          <>
            <Link href="/dashboard" style={{ color: 'white', textDecoration: 'none' }}>Mi portal</Link>
            <button
              onClick={logout}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: 14,
                padding: 0,
              }}
            >
              Salir
            </button>
          </>
        ) : (
          <>
            <Link href="/login" style={{ color: 'white', textDecoration: 'none' }}>Iniciar sesión</Link>
            <Link href="/signup" style={{ color: 'white', textDecoration: 'none' }}>Crear cuenta</Link>
          </>
        )}
      </nav>
    </header>
  );
}
