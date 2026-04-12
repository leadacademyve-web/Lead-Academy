import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';
import { useAuthUser } from '@/src/context/AuthUserProvider';

function getUserName(user: any) {
  const metadata = user?.user_metadata || {};

  return (
    metadata.full_name ||
    metadata.name ||
    metadata.first_name ||
    (user?.email ? user.email.split('@')[0] : '')
  );
}

export default function Header() {
  const { user, setUser, loading } = useAuthUser();
  const router = useRouter();
  const userName = getUserName(user);

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
        padding: '08px 32px',
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
          gap: 30,
          textDecoration: 'none',
          color: 'white',
        }}
      >
        <Image src="/Logo.png" alt="Lead Academy - Trading & Investing" width={66} height={66} />
        <div style={{ lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, fontSize: 20 }}>Lead Academy - Trading & Investing</div>
          <div style={{ fontSize: 16, opacity: 0.75 }}>Portal Privado - Version WEB page para desktop no compatible con mobiles</div>
        </div>
      </Link>

      <nav
        className="topnav"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 16,
        }}
      >
        {loading ? null : user ? (
          <>
            <span style={{ opacity: 0.8 }}>👤 {userName}</span>
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
                fontSize: 16,
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
