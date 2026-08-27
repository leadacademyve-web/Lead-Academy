import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';

type StudentRow = {
  user_id: string;
  email: string;
  full_name: string;
  is_paused: boolean;
  remaining_classes: number;
  total_classes: number;
  classes_used: number;
  access_active: boolean;
  last_seen: string | null;
  is_watching: boolean;
};

function isRecent(value?: string | null) {
  if (!value) return false;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) && Date.now() - ts <= 45000;
}

export default function GestionOperativaPage() {
  const router = useRouter();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [search, setSearch] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.replace('/login?next=/gestion-operativa');
      return;
    }

    const { data: adminOk, error: adminError } = await supabase.rpc('is_portal_admin');
    if (adminError || !adminOk) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);
    const { data, error } = await supabase.rpc('admin_operational_students');
    if (error) {
      setMessage(error.message);
      setRows([]);
    } else {
      setRows((data || []) as StudentRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.full_name} ${r.email}`.toLowerCase().includes(q)
    );
  }, [rows, search]);

  async function setPause(row: StudentRow, pause: boolean) {
    const reason = window.prompt(
      pause
        ? `Motivo para pausar a ${row.full_name}:`
        : `Motivo para reactivar a ${row.full_name}:`
    );
    if (!reason?.trim()) return;

    setWorkingId(row.user_id);
    setMessage(null);
    const { error } = await supabase.rpc('admin_set_class_pause', {
      p_user_id: row.user_id,
      p_pause: pause,
      p_reason: reason.trim(),
    });
    setWorkingId(null);
    if (error) return setMessage(error.message);
    await load();
  }

  async function changeCounters(
    row: StudentRow,
    operation: 'add_package' | 'remove_package' | 'consume' | 'refund'
  ) {
    const labels = {
      add_package: 'Agregar 1 clase al paquete',
      remove_package: 'Quitar 1 clase del paquete',
      consume: 'Marcar 1 clase como consumida',
      refund: 'Devolver 1 clase consumida',
    };

    const reason = window.prompt(`${labels[operation]} — ${row.full_name}\n\nMotivo administrativo:`);
    if (!reason?.trim()) return;

    setWorkingId(row.user_id);
    setMessage(null);

    const { data, error } = await supabase.rpc('admin_change_class_counters', {
      p_user_id: row.user_id,
      p_operation: operation,
      p_amount: 1,
      p_reason: reason.trim(),
    });

    setWorkingId(null);
    if (error) return setMessage(error.message);

    const result = Array.isArray(data) ? data[0] : data;
    if (result) {
      setMessage(
        `${labels[operation]} completado. ` +
        `${result.classes_used}/${result.total_classes} usadas · ${result.remaining_classes} restantes.`
      );
    }
    await load();
  }

  if (loading) {
    return <main style={styles.page}><div style={styles.card}>Cargando Gestión Operativa...</div></main>;
  }

  if (!authorized) {
    return (
      <main style={styles.page}>
        <div style={styles.card}>
          <h1>Acceso restringido</h1>
          <p>Esta página es exclusiva para administradores autorizados.</p>
          <button style={styles.button} onClick={() => router.push('/dashboard')}>Volver al portal</button>
        </div>
      </main>
    );
  }

  const connected = rows.filter((r) => isRecent(r.last_seen)).length;
  const watching = rows.filter((r) => isRecent(r.last_seen) && r.is_watching).length;
  const paused = rows.filter((r) => r.is_paused).length;

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>LEAD ACADEMY</div>
          <h1 style={{ margin: '6px 0 0' }}>Gestión Operativa</h1>
          <p style={styles.muted}>Clases, pausas, saldos y presencia en vivo.</p>
        </div>
        <button style={styles.buttonSecondary} onClick={() => router.push('/dashboard')}>Volver al Dashboard</button>
      </div>

      <div style={styles.stats}>
        <div style={styles.stat}><strong>{connected}</strong><span>Conectados ahora</span></div>
        <div style={styles.stat}><strong>{watching}</strong><span>Viendo LIVE</span></div>
        <div style={styles.stat}><strong>{paused}</strong><span>Pausados</span></div>
        <div style={styles.stat}><strong>{rows.length}</strong><span>Con acceso/clases</span></div>
      </div>

      <div style={styles.card}>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={styles.eyebrow}>ESTUDIANTES</div>
            <h2 style={{ margin: '6px 0 0' }}>Control académico</h2>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nombre o correo..."
            style={styles.input}
          />
        </div>

        {message ? <div style={styles.notice}>{message}</div> : null}

        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Estudiante</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Saldo</th>
                <th style={styles.th}>Portal</th>
                <th style={styles.th}>LIVE</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const busy = workingId === row.user_id;
                const online = isRecent(row.last_seen);
                return (
                  <tr key={row.user_id}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 800 }}>{row.full_name || 'Estudiante'}</div>
                      <div style={styles.mutedSmall}>{row.email}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={row.is_paused ? styles.pillPaused : styles.pillActive}>
                        {row.is_paused ? '⏸ PAUSADO' : '● ACTIVO'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <strong>{row.remaining_classes}</strong> restantes
                      <div style={styles.mutedSmall}>{row.classes_used}/{row.total_classes} usadas</div>
                    </td>
                    <td style={styles.td}>{online ? '🟢 Conectado' : '—'}</td>
                    <td style={styles.td}>{online && row.is_watching ? '🔴 Viendo' : '—'}</td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button disabled={busy} style={styles.action} onClick={() => changeCounters(row, 'add_package')}>＋ Paquete</button>
                        <button disabled={busy || row.total_classes <= row.classes_used} style={styles.action} onClick={() => changeCounters(row, 'remove_package')}>− Paquete</button>
                        <button disabled={busy || row.remaining_classes <= 0} style={styles.action} onClick={() => changeCounters(row, 'consume')}>✓ Consumir</button>
                        <button disabled={busy || row.classes_used <= 0} style={styles.action} onClick={() => changeCounters(row, 'refund')}>↩ Devolver</button>
                        {row.is_paused ? (
                          <button disabled={busy} style={styles.actionPrimary} onClick={() => setPause(row, false)}>▶ Reactivar</button>
                        ) : (
                          <button disabled={busy} style={styles.actionWarn} onClick={() => setPause(row, true)}>⏸ Pausar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.eyebrow}>SIGUIENTE ETAPA</div>
        <h2 style={{ margin: '6px 0 8px' }}>Asistencia y repeticiones</h2>
        <p style={styles.muted}>
          La base de datos ya queda preparada para registrar sesiones LIVE, asistencia individual y derechos de repetición.
          Esta fase no modifica todavía el mecanismo actual que descuenta clases al publicar videos.
        </p>
      </div>
    </main>
  );
}

const styles: Record<string, any> = {
  page: {
    minHeight: '100vh',
    padding: '28px',
    color: '#fff',
    background: 'linear-gradient(180deg, rgba(2,6,23,.88), rgba(2,6,23,.95)), url("/trading-bg.jpg") center/cover fixed',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  },
  header: {
    maxWidth: 1500,
    margin: '0 auto 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  eyebrow: { fontSize: 12, letterSpacing: 1.4, fontWeight: 900, opacity: .68 },
  muted: { color: 'rgba(255,255,255,.68)', margin: '8px 0 0', lineHeight: 1.5 },
  mutedSmall: { color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 4 },
  stats: {
    maxWidth: 1500,
    margin: '0 auto 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
    gap: 12,
  },
  stat: {
    border: '1px solid rgba(255,255,255,.10)',
    borderRadius: 18,
    padding: 18,
    background: 'rgba(15,23,42,.72)',
    display: 'grid',
    gap: 6,
  },
  card: {
    maxWidth: 1500,
    margin: '0 auto 20px',
    border: '1px solid rgba(255,255,255,.10)',
    borderRadius: 22,
    padding: 22,
    background: 'rgba(7,18,39,.78)',
    boxShadow: '0 18px 50px rgba(0,0,0,.25)',
    backdropFilter: 'blur(12px)',
  },
  input: {
    minWidth: 300,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,.14)',
    background: 'rgba(255,255,255,.05)',
    color: '#fff',
    outline: 'none',
  },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 980 },
  th: { textAlign: 'left', padding: '12px 10px', color: 'rgba(255,255,255,.55)', fontSize: 12, letterSpacing: .8 },
  td: { padding: '14px 10px', borderTop: '1px solid rgba(255,255,255,.07)', verticalAlign: 'middle' },
  pillActive: { display: 'inline-block', padding: '6px 10px', borderRadius: 999, background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.35)', color: '#bbf7d0', fontSize: 12, fontWeight: 900 },
  pillPaused: { display: 'inline-block', padding: '6px 10px', borderRadius: 999, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.35)', color: '#fde68a', fontSize: 12, fontWeight: 900 },
  action: { padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer' },
  actionPrimary: { padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(34,197,94,.35)', background: 'rgba(34,197,94,.16)', color: '#dcfce7', cursor: 'pointer' },
  actionWarn: { padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(245,158,11,.35)', background: 'rgba(245,158,11,.16)', color: '#fef3c7', cursor: 'pointer' },
  button: { padding: '10px 14px', borderRadius: 12, border: 0, background: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  buttonSecondary: { padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  notice: { padding: '10px 12px', borderRadius: 12, marginBottom: 12, background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.28)' },
};
