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

type ReplaySession = {
  session_id: string;
  started_at: string;
  ended_at: string;
  replay_published: boolean;
  replay_video_id: string | null;
  replay_video_url: string | null;
};

type CounterOperation = 'add_package' | 'remove_package' | 'consume' | 'refund';

type StudentModal = {
  row: StudentRow;
  kind: 'pause' | 'counter';
  pause?: boolean;
  operation?: CounterOperation;
};

function isRecent(value?: string | null) {
  if (!value) return false;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) && Date.now() - ts <= 45000;
}

function formatPersonName(value?: string | null) {
  const text = (value || '').trim().replace(/\s+/g, ' ');
  if (!text) return 'Estudiante';
  return text
    .toLocaleLowerCase('es')
    .split(' ')
    .map((part) => part ? part.charAt(0).toLocaleUpperCase('es') + part.slice(1) : part)
    .join(' ');
}

function formatSessionDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('es-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit'
  }).format(d);
}

export default function GestionOperativaPage() {
  const router = useRouter();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [replaySessions, setReplaySessions] = useState<ReplaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [search, setSearch] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [studentModal, setStudentModal] = useState<StudentModal | null>(null);
  const [reason, setReason] = useState('');

  const [vimeoId, setVimeoId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

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

    const [studentsResult, replayResult] = await Promise.all([
      supabase.rpc('admin_operational_students'),
      supabase.rpc('admin_replay_sessions'),
    ]);

    if (studentsResult.error) {
      setMessage(studentsResult.error.message);
      setRows([]);
    } else {
      setRows((studentsResult.data || []) as StudentRow[]);
    }

    if (replayResult.error) {
      setMessage((current) => current || `Repeticiones: ${replayResult.error.message}`);
      setReplaySessions([]);
    } else {
      setReplaySessions((replayResult.data || []) as ReplaySession[]);
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
    const q = search.trim().toLocaleLowerCase('es');
    return rows
      .filter((r) => !q || `${r.full_name} ${r.email}`.toLocaleLowerCase('es').includes(q))
      .slice()
      .sort((a, b) => formatPersonName(a.full_name).localeCompare(formatPersonName(b.full_name), 'es', { sensitivity: 'base' }));
  }, [rows, search]);

  const pendingSessions = useMemo(
    () => replaySessions.filter((s) => !s.replay_published),
    [replaySessions]
  );

  const selectedSession = pendingSessions.find((s) => s.session_id === selectedSessionId) || null;

  const counterLabels: Record<CounterOperation, string> = {
    add_package: 'Agregar 1 clase al paquete',
    remove_package: 'Quitar 1 clase del paquete',
    consume: 'Marcar 1 clase como consumida',
    refund: 'Devolver 1 clase consumida',
  };

  function openPauseModal(row: StudentRow, pause: boolean) {
    setReason('');
    setStudentModal({ row, kind: 'pause', pause });
  }

  function openCounterModal(row: StudentRow, operation: CounterOperation) {
    setReason('');
    setStudentModal({ row, kind: 'counter', operation });
  }

  async function submitStudentModal() {
    if (!studentModal || !reason.trim()) return;
    const { row } = studentModal;
    setWorkingId(row.user_id);
    setMessage(null);

    if (studentModal.kind === 'pause') {
      const { error } = await supabase.rpc('admin_set_class_pause', {
        p_user_id: row.user_id,
        p_pause: !!studentModal.pause,
        p_reason: reason.trim(),
      });
      setWorkingId(null);
      if (error) return setMessage(error.message);
      setMessage(studentModal.pause ? `${formatPersonName(row.full_name)} fue pausado.` : `${formatPersonName(row.full_name)} fue reactivado.`);
    } else {
      const operation = studentModal.operation as CounterOperation;
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
        setMessage(`${counterLabels[operation]} completado. ${result.classes_used}/${result.total_classes} usadas · ${result.remaining_classes} restantes.`);
      }
    }

    setStudentModal(null);
    setReason('');
    await load();
  }

  function requestPublish() {
    const clean = vimeoId.trim();
    if (!/^\d+$/.test(clean)) {
      setMessage('Introduce solamente el número del video de Vimeo.');
      return;
    }
    if (!selectedSessionId) {
      setMessage('Selecciona la sesión LIVE a la que pertenece esta repetición.');
      return;
    }
    setMessage(null);
    setPublishConfirmOpen(true);
  }

  async function publishReplay() {
    if (!selectedSessionId || !/^\d+$/.test(vimeoId.trim())) return;
    setPublishing(true);
    setMessage(null);

    const { error } = await supabase.rpc('admin_publish_live_replay', {
      p_session_id: selectedSessionId,
      p_vimeo_id: vimeoId.trim(),
    });

    setPublishing(false);
    if (error) {
      setPublishConfirmOpen(false);
      setMessage(error.message);
      return;
    }

    setPublishConfirmOpen(false);
    setVimeoId('');
    setSelectedSessionId('');
    setMessage('Repetición publicada y asociada correctamente a la sesión LIVE.');
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
          <p style={styles.muted}>Clases, pausas, saldos, presencia en vivo y repeticiones.</p>
        </div>
        <button style={styles.buttonSecondary} onClick={() => router.push('/dashboard')}>Volver al Dashboard</button>
      </div>

      <div style={styles.stats}>
        <div style={styles.stat}><strong>{connected}</strong><span>Conectados ahora</span></div>
        <div style={styles.stat}><strong>{watching}</strong><span>Viendo LIVE</span></div>
        <div style={styles.stat}><strong>{paused}</strong><span>Pausados</span></div>
        <div style={styles.stat}><strong>{rows.length}</strong><span>Con acceso/clases</span></div>
      </div>

      {/* REPETICIONES ARRIBA DE LOS ESTUDIANTES */}
      <div style={styles.card}>
        <div style={styles.eyebrow}>REPETICIONES</div>
        <h2 style={{ margin: '6px 0 8px' }}>Publicar repetición de una sesión LIVE</h2>
        <p style={styles.muted}>Introduce el número de Vimeo y selecciona exactamente la sesión LIVE correspondiente. El portal hará la asociación internamente.</p>

        <div style={styles.replayGrid}>
          <div>
            <div style={styles.fieldLabel}>ID de Vimeo</div>
            <input
              value={vimeoId}
              onChange={(e) => setVimeoId(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej. 1217366012"
              inputMode="numeric"
              style={{ ...styles.input, width: '100%', minWidth: 0, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <div style={styles.fieldLabel}>Sesión LIVE</div>
            <button type="button" style={styles.sessionButton} onClick={() => setSessionPickerOpen(true)}>
              <span>{selectedSession ? `${formatSessionDate(selectedSession.started_at)} → ${formatSessionDate(selectedSession.ended_at)}` : 'Seleccionar sesión LIVE'}</span>
              <span>▾</span>
            </button>
          </div>

          <button
            type="button"
            style={{ ...styles.button, alignSelf: 'end', opacity: (!vimeoId || !selectedSessionId) ? .55 : 1 }}
            disabled={!vimeoId || !selectedSessionId || publishing}
            onClick={requestPublish}
          >
            Publicar repetición
          </button>
        </div>
        <div style={styles.mutedSmall}>{pendingSessions.length} sesión(es) finalizada(s) pendiente(s) de repetición. Las sesiones ya asociadas no pueden seleccionarse nuevamente.</div>
      </div>

      <div style={styles.card}>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={styles.eyebrow}>ESTUDIANTES</div>
            <h2 style={{ margin: '6px 0 0' }}>Control académico</h2>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre o correo..." style={styles.input} />
        </div>

        {message ? <div style={styles.notice}>{message}</div> : null}

        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>Estudiante</th><th style={styles.th}>Estado</th><th style={styles.th}>Saldo</th>
              <th style={styles.th}>Portal</th><th style={styles.th}>LIVE</th><th style={styles.th}>Acciones</th>
            </tr></thead>
            <tbody>
              {filtered.map((row) => {
                const busy = workingId === row.user_id;
                const online = isRecent(row.last_seen);
                return (
                  <tr key={row.user_id}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 800 }}>{formatPersonName(row.full_name)}</div>
                      <div style={styles.mutedSmall}>{row.email}</div>
                    </td>
                    <td style={styles.td}><span style={row.is_paused ? styles.pillPaused : styles.pillActive}>{row.is_paused ? '⏸ PAUSADO' : '● ACTIVO'}</span></td>
                    <td style={styles.td}><strong>{row.remaining_classes}</strong> restantes<div style={styles.mutedSmall}>{row.classes_used}/{row.total_classes} usadas</div></td>
                    <td style={styles.td}>{online ? '🟢 Conectado' : '—'}</td>
                    <td style={styles.td}>{online && row.is_watching ? '🔴 Viendo' : '—'}</td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button disabled={busy} style={styles.action} onClick={() => openCounterModal(row, 'add_package')}>＋ Paquete</button>
                        <button disabled={busy || row.total_classes <= row.classes_used} style={styles.action} onClick={() => openCounterModal(row, 'remove_package')}>− Paquete</button>
                        <button disabled={busy || row.remaining_classes <= 0} style={styles.action} onClick={() => openCounterModal(row, 'consume')}>✓ Consumir</button>
                        <button disabled={busy || row.classes_used <= 0} style={styles.action} onClick={() => openCounterModal(row, 'refund')}>↩ Devolver</button>
                        {row.is_paused
                          ? <button disabled={busy} style={styles.actionPrimary} onClick={() => openPauseModal(row, false)}>▶ Reactivar</button>
                          : <button disabled={busy} style={styles.actionWarn} onClick={() => openPauseModal(row, true)}>⏸ Pausar</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: SELECCIONAR SESIÓN */}
      {sessionPickerOpen && (
        <div style={styles.modalBackdrop} onMouseDown={() => setSessionPickerOpen(false)}>
          <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div><div style={styles.eyebrow}>REPETICIÓN</div><h2 style={{ margin: '6px 0 0' }}>Seleccionar sesión LIVE</h2></div>
              <button style={styles.closeButton} onClick={() => setSessionPickerOpen(false)}>×</button>
            </div>
            <p style={styles.muted}>Selecciona la clase exacta a la que pertenece el video.</p>
            <div style={styles.sessionList}>
              {pendingSessions.length === 0 ? <div style={styles.empty}>No hay sesiones finalizadas pendientes de repetición.</div> : pendingSessions.map((s) => (
                <button key={s.session_id} style={selectedSessionId === s.session_id ? styles.sessionOptionSelected : styles.sessionOption} onClick={() => { setSelectedSessionId(s.session_id); setSessionPickerOpen(false); }}>
                  <strong>{formatSessionDate(s.started_at)}</strong>
                  <span style={styles.mutedSmall}>Finalizó: {formatSessionDate(s.ended_at)}</span>
                </button>
              ))}
            </div>
            <div style={styles.modalActions}><button style={styles.buttonSecondary} onClick={() => setSessionPickerOpen(false)}>Cancelar</button></div>
          </div>
        </div>
      )}

      {/* MODAL: ACCIÓN DE ESTUDIANTE */}
      {studentModal && (
        <div style={styles.modalBackdrop} onMouseDown={() => setStudentModal(null)}>
          <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.eyebrow}>CONTROL ACADÉMICO</div>
                <h2 style={{ margin: '6px 0 0' }}>{studentModal.kind === 'pause' ? (studentModal.pause ? 'Pausar estudiante' : 'Reactivar estudiante') : counterLabels[studentModal.operation as CounterOperation]}</h2>
              </div>
              <button style={styles.closeButton} onClick={() => setStudentModal(null)}>×</button>
            </div>
            <p style={styles.muted}><strong style={{ color: '#fff' }}>{formatPersonName(studentModal.row.full_name)}</strong><br />{studentModal.row.email}</p>
            <div style={styles.fieldLabel}>Motivo administrativo</div>
            <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Escribe el motivo..." style={styles.textarea} />
            <div style={styles.modalActions}>
              <button style={styles.buttonSecondary} onClick={() => setStudentModal(null)}>Cancelar</button>
              <button disabled={!reason.trim() || workingId === studentModal.row.user_id} style={{ ...styles.button, opacity: !reason.trim() ? .55 : 1 }} onClick={submitStudentModal}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR PUBLICACIÓN */}
      {publishConfirmOpen && selectedSession && (
        <div style={styles.modalBackdrop} onMouseDown={() => !publishing && setPublishConfirmOpen(false)}>
          <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={styles.eyebrow}>CONFIRMAR PUBLICACIÓN</div>
            <h2 style={{ margin: '6px 0 8px' }}>Publicar repetición</h2>
            <div style={styles.confirmBox}>
              <div><span style={styles.mutedSmall}>Vimeo</span><br /><strong>{vimeoId}</strong></div>
              <div><span style={styles.mutedSmall}>Sesión LIVE</span><br /><strong>{formatSessionDate(selectedSession.started_at)}</strong><br /><span style={styles.mutedSmall}>hasta {formatSessionDate(selectedSession.ended_at)}</span></div>
            </div>
            <p style={styles.muted}>Al publicar, esta repetición quedará asociada a esta sesión y se ejecutará el mecanismo de consumo de clases configurado para la sesión.</p>
            <div style={styles.modalActions}>
              <button disabled={publishing} style={styles.buttonSecondary} onClick={() => setPublishConfirmOpen(false)}>Cancelar</button>
              <button disabled={publishing} style={styles.button} onClick={publishReplay}>{publishing ? 'Publicando...' : 'Publicar repetición'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const styles: Record<string, any> = {
  page: { minHeight: '100vh', padding: '28px', color: '#fff', background: 'linear-gradient(180deg, rgba(2,6,23,.88), rgba(2,6,23,.95)), url("/trading-bg.jpg") center/cover fixed', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  header: { maxWidth: 1500, margin: '0 auto 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  eyebrow: { fontSize: 12, letterSpacing: 1.4, fontWeight: 900, opacity: .68 },
  muted: { color: 'rgba(255,255,255,.68)', margin: '8px 0 0', lineHeight: 1.5 },
  mutedSmall: { color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 4 },
  stats: { maxWidth: 1500, margin: '0 auto 20px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 },
  stat: { border: '1px solid rgba(255,255,255,.10)', borderRadius: 18, padding: 18, background: 'rgba(15,23,42,.72)', display: 'grid', gap: 6 },
  card: { maxWidth: 1500, margin: '0 auto 20px', border: '1px solid rgba(255,255,255,.10)', borderRadius: 22, padding: 22, background: 'rgba(7,18,39,.78)', boxShadow: '0 18px 50px rgba(0,0,0,.25)', backdropFilter: 'blur(12px)' },
  input: { minWidth: 300, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff', outline: 'none' },
  textarea: { width: '100%', minHeight: 110, resize: 'vertical', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff', outline: 'none', font: 'inherit' },
  fieldLabel: { fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.72)', margin: '0 0 7px' },
  replayGrid: { display: 'grid', gridTemplateColumns: 'minmax(180px,.75fr) minmax(320px,1.75fr) auto', gap: 12, alignItems: 'end', marginTop: 18 },
  sessionButton: { width: '100%', minHeight: 43, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff', cursor: 'pointer', textAlign: 'left' },
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
  modalBackdrop: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(2,6,23,.78)', backdropFilter: 'blur(7px)' },
  modal: { width: 'min(680px, 100%)', maxHeight: '85vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,.14)', borderRadius: 22, padding: 22, background: '#081326', boxShadow: '0 30px 90px rgba(0,0,0,.55)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' },
  closeButton: { width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: 24, lineHeight: 1, cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  sessionList: { display: 'grid', gap: 9, marginTop: 16 },
  sessionOption: { display: 'grid', gap: 4, width: '100%', padding: '13px 14px', borderRadius: 13, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: '#fff', textAlign: 'left', cursor: 'pointer' },
  sessionOptionSelected: { display: 'grid', gap: 4, width: '100%', padding: '13px 14px', borderRadius: 13, border: '1px solid rgba(59,130,246,.55)', background: 'rgba(37,99,235,.18)', color: '#fff', textAlign: 'left', cursor: 'pointer' },
  empty: { padding: 18, borderRadius: 12, background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.65)' },
  confirmBox: { display: 'grid', gap: 14, marginTop: 16, padding: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)' },
};
