import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';

type ReplaySession = {
  session_id: string;
  started_at: string;
  ended_at: string;
  has_replay: boolean;
};

type AdminAction = {
  row: StudentRow;
  kind: 'pause' | 'resume' | 'add_package' | 'remove_package' | 'consume' | 'refund';
  label: string;
};

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
  const [activeLiveSession, setActiveLiveSession] = useState<{ session_id: string; session_started_at: string } | null>(null);
  const [liveWorking, setLiveWorking] = useState(false);
  const [liveModal, setLiveModal] = useState<'start' | 'end' | null>(null);
  const [adminAction, setAdminAction] = useState<AdminAction | null>(null);
  const [adminReason, setAdminReason] = useState('');
  const [replaySessions, setReplaySessions] = useState<ReplaySession[]>([]);
  const [vimeoId, setVimeoId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [replayWorking, setReplayWorking] = useState(false);
  const [replayConfirm, setReplayConfirm] = useState(false);

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

    const { data: liveData } = await supabase.rpc('get_active_live_class');
    const liveRow = Array.isArray(liveData) ? liveData[0] : liveData;
    setActiveLiveSession(liveRow?.session_id ? liveRow : null);

    const { data: replayData, error: replayError } = await supabase.rpc('admin_replay_sessions');
    if (!replayError) {
      const sessions = (replayData || []) as ReplaySession[];
      setReplaySessions(sessions);
      setSelectedSessionId((current) =>
        current && sessions.some((s) => s.session_id === current && !s.has_replay) ? current : ''
      );
    }

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

  function openPauseAction(row: StudentRow, pause: boolean) {
    setAdminReason('');
    setAdminAction({
      row,
      kind: pause ? 'pause' : 'resume',
      label: pause ? 'Pausar estudiante' : 'Reactivar estudiante',
    });
  }

  function openCounterAction(
    row: StudentRow,
    operation: 'add_package' | 'remove_package' | 'consume' | 'refund'
  ) {
    const labels = {
      add_package: 'Agregar 1 clase al paquete',
      remove_package: 'Quitar 1 clase del paquete',
      consume: 'Marcar 1 clase como consumida',
      refund: 'Devolver 1 clase consumida',
    };
    setAdminReason('');
    setAdminAction({ row, kind: operation, label: labels[operation] });
  }

  async function submitAdminAction() {
    if (!adminAction || !adminReason.trim()) return;
    const { row, kind, label } = adminAction;
    setWorkingId(row.user_id);
    setMessage(null);

    if (kind === 'pause' || kind === 'resume') {
      const { error } = await supabase.rpc('admin_set_class_pause', {
        p_user_id: row.user_id,
        p_pause: kind === 'pause',
        p_reason: adminReason.trim(),
      });
      setWorkingId(null);
      if (error) return setMessage(error.message);
    } else {
      const { data, error } = await supabase.rpc('admin_change_class_counters', {
        p_user_id: row.user_id,
        p_operation: kind,
        p_amount: 1,
        p_reason: adminReason.trim(),
      });
      setWorkingId(null);
      if (error) return setMessage(error.message);
      const result = Array.isArray(data) ? data[0] : data;
      if (result) {
        setMessage(`${label} completado. ${result.classes_used}/${result.total_classes} usadas · ${result.remaining_classes} restantes.`);
      }
    }

    setAdminAction(null);
    setAdminReason('');
    await load();
  }

  async function publishReplay() {
    const cleanVimeoId = vimeoId.trim();
    if (!/^\d+$/.test(cleanVimeoId) || !selectedSessionId || replayWorking) return;
    setReplayWorking(true);
    setMessage(null);
    const { error } = await supabase.rpc('admin_publish_live_replay', {
      p_live_session_id: selectedSessionId,
      p_vimeo_id: cleanVimeoId,
    });
    setReplayWorking(false);
    setReplayConfirm(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setVimeoId('');
    setSelectedSessionId('');
    setMessage('Repetición publicada correctamente y consumo de clases procesado.');
    await load();
  }

  async function startLiveClass() {
    if (liveWorking) return;
    setLiveWorking(true);
    setMessage(null);
    const { error } = await supabase.rpc('admin_start_live_class');
    setLiveWorking(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setLiveModal(null);
    await load();
  }

  async function endLiveClass() {
    if (liveWorking) return;
    setLiveWorking(true);
    setMessage(null);
    const { error } = await supabase.rpc('admin_end_live_class');
    setLiveWorking(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setLiveModal(null);
    await load();
  }

  function formatLiveTime(value: string) {
    return new Date(value).toLocaleString([], {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit'
    });
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

      <div style={{
        ...styles.card,
        border: activeLiveSession ? '1px solid rgba(239,68,68,.42)' : '1px solid rgba(255,255,255,.10)',
        background: activeLiveSession ? 'linear-gradient(180deg, rgba(127,29,29,.24), rgba(7,18,39,.82))' : styles.card.background,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <div style={styles.eyebrow}>CLASE LIVE</div>
            <h2 style={{ margin: '6px 0 6px' }}>
              {activeLiveSession ? '🔴 CLASE EN CURSO' : 'Sin clase activa'}
            </h2>
            <p style={styles.muted}>
              {activeLiveSession
                ? `Iniciada: ${formatLiveTime(activeLiveSession.session_started_at)}`
                : 'Inicia la sesión administrativa cuando comience la clase. La transmisión de video continúa controlándose desde OBS.'}
            </p>
          </div>
          {activeLiveSession ? (
            <button style={styles.liveEndButton} disabled={liveWorking} onClick={() => setLiveModal('end')}>
              ■ Finalizar clase
            </button>
          ) : (
            <button style={styles.liveStartButton} disabled={liveWorking} onClick={() => setLiveModal('start')}>
              ▶ Iniciar clase
            </button>
          )}
        </div>
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
                        <button disabled={busy} style={styles.action} onClick={() => openCounterAction(row, 'add_package')}>＋ Paquete</button>
                        <button disabled={busy || row.total_classes <= row.classes_used} style={styles.action} onClick={() => openCounterAction(row, 'remove_package')}>− Paquete</button>
                        <button disabled={busy || row.remaining_classes <= 0} style={styles.action} onClick={() => openCounterAction(row, 'consume')}>✓ Consumir</button>
                        <button disabled={busy || row.classes_used <= 0} style={styles.action} onClick={() => openCounterAction(row, 'refund')}>↩ Devolver</button>
                        {row.is_paused ? (
                          <button disabled={busy} style={styles.actionPrimary} onClick={() => openPauseAction(row, false)}>▶ Reactivar</button>
                        ) : (
                          <button disabled={busy} style={styles.actionWarn} onClick={() => openPauseAction(row, true)}>⏸ Pausar</button>
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
        <div style={styles.eyebrow}>REPETICIONES</div>
        <h2 style={{ margin: '6px 0 8px' }}>Publicar repetición de una sesión LIVE</h2>
        <p style={styles.muted}>
          Introduce el número de Vimeo y selecciona exactamente la sesión a la que pertenece. El portal asociará la repetición con esa sesión y aplicará automáticamente las reglas de asistencia y pausa.
        </p>
        <div style={styles.replayGrid}>
          <label style={styles.fieldLabel}>
            <span>ID de Vimeo</span>
            <input
              value={vimeoId}
              onChange={(e) => setVimeoId(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej. 1217366012"
              inputMode="numeric"
              style={{ ...styles.input, minWidth: 0, width: '100%' }}
            />
          </label>
          <label style={styles.fieldLabel}>
            <span>Sesión LIVE</span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              style={{ ...styles.input, minWidth: 0, width: '100%' }}
            >
              <option value="">Selecciona una sesión finalizada...</option>
              {replaySessions.filter((s) => !s.has_replay).map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {formatLiveTime(s.started_at)} → {formatLiveTime(s.ended_at)}
                </option>
              ))}
            </select>
          </label>
          <button
            style={styles.button}
            disabled={replayWorking || !/^\d+$/.test(vimeoId.trim()) || !selectedSessionId}
            onClick={() => setReplayConfirm(true)}
          >
            Publicar repetición
          </button>
        </div>
        <div style={styles.mutedSmall}>
          {replaySessions.filter((s) => !s.has_replay).length} sesión(es) finalizada(s) pendientes de repetición. Las sesiones ya asociadas no pueden seleccionarse nuevamente.
        </div>
      </div>
      {adminAction ? (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget && !workingId) setAdminAction(null); }} style={styles.modalBackdrop}>
          <div role="dialog" aria-modal="true" style={styles.modalCard}>
            <div style={styles.eyebrow}>ACCIÓN ADMINISTRATIVA</div>
            <h2 style={{ margin: '8px 0 6px' }}>{adminAction.label}</h2>
            <p style={styles.muted}>{adminAction.row.full_name} · {adminAction.row.email}</p>
            <label style={{ ...styles.fieldLabel, marginTop: 18 }}>
              <span>Motivo administrativo</span>
              <textarea autoFocus value={adminReason} onChange={(e) => setAdminReason(e.target.value)} rows={4} style={{ ...styles.input, width: '100%', minWidth: 0, resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <button style={styles.buttonSecondary} disabled={!!workingId} onClick={() => setAdminAction(null)}>Cancelar</button>
              <button style={styles.button} disabled={!!workingId || !adminReason.trim()} onClick={submitAdminAction}>{workingId ? 'Procesando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {replayConfirm ? (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget && !replayWorking) setReplayConfirm(false); }} style={styles.modalBackdrop}>
          <div role="dialog" aria-modal="true" style={styles.modalCard}>
            <div style={styles.eyebrow}>PUBLICAR REPETICIÓN</div>
            <h2 style={{ margin: '8px 0 10px' }}>¿Confirmar publicación?</h2>
            <p style={styles.muted}>Vimeo: <strong>{vimeoId}</strong></p>
            <p style={styles.muted}>Sesión: <strong>{(() => { const x = replaySessions.find((s) => s.session_id === selectedSessionId); return x ? `${formatLiveTime(x.started_at)} → ${formatLiveTime(x.ended_at)}` : '—'; })()}</strong></p>
            <div style={styles.warningBox}>Al confirmar, la repetición será publicada y el sistema procesará el consumo de clases correspondiente a esta sesión.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <button style={styles.buttonSecondary} disabled={replayWorking} onClick={() => setReplayConfirm(false)}>Cancelar</button>
              <button style={styles.button} disabled={replayWorking} onClick={publishReplay}>{replayWorking ? 'Publicando...' : 'Sí, publicar repetición'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {liveModal ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !liveWorking) setLiveModal(null);
          }}
          style={styles.modalBackdrop}
        >
          <div role="dialog" aria-modal="true" style={styles.modalCard}>
            <div style={styles.eyebrow}>CLASE LIVE</div>
            <h2 style={{ margin: '8px 0 10px' }}>
              {liveModal === 'start' ? '¿Iniciar la clase?' : '¿Finalizar la clase?'}
            </h2>
            <p style={styles.muted}>
              {liveModal === 'start'
                ? 'Desde este momento la clase quedará oficialmente abierta para el control de asistencia.'
                : 'Al finalizar, ningún estudiante podrá registrar una nueva asistencia para esta sesión.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <button style={styles.buttonSecondary} disabled={liveWorking} onClick={() => setLiveModal(null)}>
                Cancelar
              </button>
              <button
                style={liveModal === 'start' ? styles.liveStartButton : styles.liveEndButton}
                disabled={liveWorking}
                onClick={liveModal === 'start' ? startLiveClass : endLiveClass}
              >
                {liveWorking
                  ? 'Procesando...'
                  : liveModal === 'start'
                    ? 'Sí, iniciar clase'
                    : 'Sí, finalizar clase'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
  liveStartButton: { padding: '12px 18px', borderRadius: 12, border: '1px solid rgba(34,197,94,.40)', background: 'rgba(34,197,94,.18)', color: '#dcfce7', fontWeight: 900, cursor: 'pointer' },
  liveEndButton: { padding: '12px 18px', borderRadius: 12, border: '1px solid rgba(239,68,68,.45)', background: 'rgba(239,68,68,.18)', color: '#fee2e2', fontWeight: 900, cursor: 'pointer' },
  modalBackdrop: { position: 'fixed', inset: 0, zIndex: 9999, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(8px)' },
  modalCard: { width: 'min(560px, 94vw)', borderRadius: 22, padding: 26, background: '#0f172a', border: '1px solid rgba(255,255,255,.14)', boxShadow: '0 30px 90px rgba(0,0,0,.55)' },
  replayGrid: { display: 'grid', gridTemplateColumns: 'minmax(180px,.65fr) minmax(320px,1.5fr) auto', gap: 12, alignItems: 'end', marginTop: 20 },
  fieldLabel: { display: 'grid', gap: 8, fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.72)' },
  warningBox: { marginTop: 18, padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.30)', color: '#fde68a', lineHeight: 1.5 },
};
