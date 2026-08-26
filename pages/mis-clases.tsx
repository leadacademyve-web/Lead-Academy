import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';

type Control = {
  user_id: string;
  email: string;
  is_paused: boolean;
  remaining_classes: number;
  total_classes: number;
  classes_used: number;
  access_active: boolean;
  paused_at: string | null;
  resumed_at: string | null;
};

export default function MisClasesPage() {
  const router = useRouter();
  const [control, setControl] = useState<Control | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.replace('/login?next=/mis-clases');
      return;
    }

    const { data, error } = await supabase.rpc('my_class_control');
    if (error) {
      setMessage(error.message);
      setControl(null);
    } else {
      const row = Array.isArray(data) ? data[0] : data;
      setControl((row || null) as Control | null);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changePause(pause: boolean) {
    if (!control || working) return;

    if (pause) {
      const ok = window.confirm(
        'Mientras tus clases estén pausadas, conservarás tu saldo. ' +
        'Las clases realizadas durante la pausa no deberán darte acceso gratuito a sus repeticiones. ' +
        '¿Deseas pausar tus clases?'
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(
        'Al reactivar, las próximas clases vuelven a ser cobrables según las reglas del portal. ¿Deseas reactivar?'
      );
      if (!ok) return;
    }

    setWorking(true);
    setMessage(null);
    const { error } = await supabase.rpc('student_set_class_pause', { p_pause: pause });
    setWorking(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(pause ? 'Tus clases quedaron pausadas.' : 'Tus clases quedaron reactivadas.');
    await load();
  }

  if (loading) return <main style={styles.page}><div style={styles.card}>Cargando tus clases...</div></main>;

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>LEAD ACADEMY</div>
            <h1 style={{ margin: '6px 0 0' }}>Mis clases</h1>
            <p style={styles.muted}>Controla tu saldo y el estado de tus próximas clases.</p>
          </div>
          <button style={styles.secondary} onClick={() => router.push('/dashboard')}>Volver al Dashboard</button>
        </div>

        {!control ? (
          <div style={styles.card}>
            <h2>No se pudo cargar tu control de clases</h2>
            {message ? <p style={styles.error}>{message}</p> : null}
          </div>
        ) : (
          <>
            <div style={styles.grid}>
              <div style={styles.card}>
                <div style={styles.eyebrow}>ESTADO</div>
                <div style={control.is_paused ? styles.bigPaused : styles.bigActive}>
                  {control.is_paused ? '⏸ PAUSADO' : '● ACTIVO'}
                </div>
                <p style={styles.muted}>
                  {control.is_paused
                    ? 'Tu saldo permanece protegido para clases futuras.'
                    : 'Las próximas clases son cobrables según las reglas normales del portal.'}
                </p>

                {control.is_paused ? (
                  <button disabled={working} style={styles.primary} onClick={() => changePause(false)}>
                    {working ? 'Procesando...' : '▶ Reactivar mis clases'}
                  </button>
                ) : (
                  <button disabled={working} style={styles.warn} onClick={() => changePause(true)}>
                    {working ? 'Procesando...' : '⏸ Pausar mis clases'}
                  </button>
                )}
              </div>

              <div style={styles.card}>
                <div style={styles.eyebrow}>SALDO</div>
                <div style={styles.balance}>{control.remaining_classes}</div>
                <div style={{ fontWeight: 800 }}>clases restantes</div>
                <p style={styles.muted}>{control.classes_used} utilizadas de {control.total_classes} contratadas.</p>
              </div>
            </div>

            {message ? <div style={styles.notice}>{message}</div> : null}

            <div style={styles.card}>
              <div style={styles.eyebrow}>REGLAS DE PAUSA</div>
              <h2 style={{ margin: '6px 0 10px' }}>Cómo funciona</h2>
              <p style={styles.muted}>
                Puedes pausar y reactivar cuando lo necesites. Pausar protege tus clases futuras, pero no revierte
                clases ya consumidas. Una clase realizada mientras tu plan estaba ACTIVO sigue siendo responsabilidad
                del estudiante aunque no haya asistido. Las clases realizadas mientras estabas PAUSADO no deben
                convertirse en repeticiones gratuitas al reactivar.
              </p>
            </div>

            <div style={styles.card}>
              <div style={styles.eyebrow}>SEGURIDAD</div>
              <p style={styles.muted}>
                El estado se guarda en la base de datos con fecha y hora del servidor. Cerrar el navegador, cambiar de equipo
                o modificar la hora local no altera el historial de pausa/reanudación.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, any> = {
  page: {
    minHeight: '100vh',
    padding: 28,
    color: '#fff',
    background: 'linear-gradient(180deg, rgba(2,6,23,.88), rgba(2,6,23,.96)), url("/trading-bg.jpg") center/cover fixed',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  },
  wrap: { maxWidth: 1050, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 },
  eyebrow: { fontSize: 12, letterSpacing: 1.4, fontWeight: 900, opacity: .68 },
  muted: { color: 'rgba(255,255,255,.68)', lineHeight: 1.55, marginTop: 8 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  card: { border: '1px solid rgba(255,255,255,.10)', borderRadius: 22, padding: 22, background: 'rgba(7,18,39,.78)', boxShadow: '0 18px 50px rgba(0,0,0,.22)', marginBottom: 16 },
  bigActive: { fontSize: 30, fontWeight: 950, color: '#86efac', marginTop: 12 },
  bigPaused: { fontSize: 30, fontWeight: 950, color: '#fde68a', marginTop: 12 },
  balance: { fontSize: 64, lineHeight: 1, fontWeight: 950, marginTop: 12 },
  primary: { marginTop: 14, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(34,197,94,.35)', background: 'rgba(34,197,94,.18)', color: '#dcfce7', fontWeight: 900, cursor: 'pointer' },
  warn: { marginTop: 14, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(245,158,11,.38)', background: 'rgba(245,158,11,.17)', color: '#fef3c7', fontWeight: 900, cursor: 'pointer' },
  secondary: { padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  notice: { border: '1px solid rgba(59,130,246,.28)', borderRadius: 14, padding: 14, background: 'rgba(59,130,246,.12)', marginBottom: 16 },
  error: { color: '#fecaca' },
};
