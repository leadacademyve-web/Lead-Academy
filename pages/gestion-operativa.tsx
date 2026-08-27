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
type VideoPublishType = 'daily' | 'course' | 'special';

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


function initialsForName(value?: string | null) {
  const parts = formatPersonName(value).split(' ').filter(Boolean);
  if (!parts.length) return 'E';
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
}

function Icon({ name, size = 24 }: { name: 'wifi' | 'video' | 'pause' | 'cap' | 'calendar' | 'gift' | 'vimeo' | 'broadcast' | 'send' | 'search'; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'wifi') return <svg {...common}><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.5 16.05a6 6 0 0 1 7 0"/><path d="M12 20h.01"/></svg>;
  if (name === 'video') return <svg {...common}><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg>;
  if (name === 'pause') return <svg {...common}><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
  if (name === 'cap') return <svg {...common}><path d="M3 10 12 5l9 5-9 5z"/><path d="M7 12v5c3 2 7 2 10 0v-5"/><path d="M21 10v6"/></svg>;
  if (name === 'calendar') return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>;
  if (name === 'gift') return <svg {...common}><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18"/><path d="M7.5 8C5 8 4 7 4 5.5S5 3 6.5 3C9 3 12 8 12 8"/><path d="M16.5 8C19 8 20 7 20 5.5S19 3 17.5 3C15 3 12 8 12 8"/></svg>;
  if (name === 'vimeo') return <svg {...common}><path d="M4 8c2-2 4-3 5-2 1 .5 1 2 1 4 0 2 1 5 2 5s2-2 3-4c1-2 1-3 0-3s-2 1-3 2c1-4 4-6 6-5 3 1 2 5 0 8-2 4-5 8-7 8-3 0-4-6-5-9 0-2-1-2-2-1z"/></svg>;
  if (name === 'broadcast') return <svg {...common}><circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/></svg>;
  if (name === 'send') return <svg {...common}><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>;
  return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
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

  const [publishType, setPublishType] = useState<VideoPublishType>('daily');
  const [vimeoId, setVimeoId] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
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

  function selectPublishType(type: VideoPublishType) {
    setPublishType(type);
    setVimeoId('');
    setVideoTitle('');
    setSelectedSessionId('');
    setPublishConfirmOpen(false);
    setMessage(null);
  }

  function requestPublish() {
    const cleanVimeo = vimeoId.trim();
    const cleanTitle = videoTitle.trim();

    if (!/^\d+$/.test(cleanVimeo)) {
      setMessage('Introduce solamente el número del video de Vimeo.');
      return;
    }

    if (publishType === 'daily' && !selectedSessionId) {
      setMessage('Selecciona la sesión LIVE a la que pertenece esta repetición.');
      return;
    }

    if ((publishType === 'course' || publishType === 'special') && !cleanTitle) {
      setMessage(publishType === 'course' ? 'Escribe el nombre del curso.' : 'Escribe el nombre del contenido gratuito.');
      return;
    }

    setMessage(null);
    setPublishConfirmOpen(true);
  }

  async function publishVideo() {
    const cleanVimeo = vimeoId.trim();
    const cleanTitle = videoTitle.trim();
    if (!/^\d+$/.test(cleanVimeo)) return;

    setPublishing(true);
    setMessage(null);

    let error: any = null;

    if (publishType === 'daily') {
      if (!selectedSessionId) {
        setPublishing(false);
        return;
      }
      const result = await supabase.rpc('admin_publish_live_replay', {
        p_session_id: selectedSessionId,
        p_vimeo_id: cleanVimeo,
      });
      error = result.error;
    } else if (publishType === 'course') {
      const result = await supabase.rpc('admin_publish_course_500', {
        p_vimeo_id: cleanVimeo,
        p_title: cleanTitle,
      });
      error = result.error;
    } else {
      const result = await supabase.rpc('admin_publish_special_video', {
        p_vimeo_id: cleanVimeo,
        p_title: cleanTitle,
      });
      error = result.error;
    }

    setPublishing(false);

    if (error) {
      setPublishConfirmOpen(false);
      setMessage(error.message);
      return;
    }

    const successMessage =
      publishType === 'daily'
        ? 'Repetición diaria publicada y asociada correctamente a la sesión LIVE.'
        : publishType === 'course'
          ? 'Curso intensivo publicado correctamente. Se aplicó el consumo configurado para INTENSIVE_TWO_DAY.'
          : 'Contenido gratuito publicado correctamente. No se descontaron clases.';

    setPublishConfirmOpen(false);
    setVimeoId('');
    setVideoTitle('');
    setSelectedSessionId('');
    setMessage(successMessage);
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
          <div style={styles.eyebrowBlue}>LEAD ACADEMY</div>
          <h1 style={styles.pageTitle}>Gestión Operativa</h1>
          <p style={styles.pageSubtitle}>Clases, pausas, saldos, presencia en vivo y repeticiones.</p>
        </div>
        <button style={styles.dashboardButton} onClick={() => router.push('/dashboard')}>←&nbsp; Volver al Dashboard</button>
      </div>

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statIconBlue}><Icon name="wifi" size={32} /></div>
          <div><strong style={styles.statNumber}>{connected}</strong><div style={styles.statLabel}>Conectados ahora</div></div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIconGreen}><Icon name="video" size={30} /></div>
          <div><strong style={styles.statNumber}>{watching}</strong><div style={styles.statLabel}>Viendo LIVE</div></div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIconAmber}><Icon name="pause" size={28} /></div>
          <div><strong style={styles.statNumber}>{paused}</strong><div style={styles.statLabel}>Pausados</div></div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIconPurple}><Icon name="cap" size={32} /></div>
          <div><strong style={styles.statNumber}>{rows.length}</strong><div style={styles.statLabel}>Con acceso/clases</div></div>
        </div>
      </div>

      {/* PUBLICACIÓN DE VIDEOS ARRIBA DE LOS ESTUDIANTES */}
      <div style={styles.publishCard}>
        <div style={styles.sectionTitle}>PUBLICAR</div>
        <p style={styles.publishIntro}>Selecciona el tipo de video. El portal aplicará automáticamente las reglas correspondientes.</p>

        <div style={styles.typeTabs}>
          <button type="button" style={publishType === 'daily' ? styles.typeTabActive : styles.typeTab} onClick={() => selectPublishType('daily')}>
            <span style={styles.typeIconBlue}><Icon name="calendar" size={28} /></span>
            <span><strong style={styles.typeTitle}>Clase diaria</strong><small style={styles.tabSub}>Desde una sesión LIVE</small></span>
            {publishType === 'daily' ? <span style={styles.activeArrow} /> : null}
          </button>

          <button type="button" style={publishType === 'course' ? styles.typeTabActiveCourse : styles.typeTab} onClick={() => selectPublishType('course')}>
            <span style={styles.typeIconAmber}><Icon name="cap" size={30} /></span>
            <span><strong style={styles.typeTitle}>Curso intensivo</strong><small style={styles.tabSub}>Solo para estudiantes del curso</small></span>
            {publishType === 'course' ? <span style={styles.activeArrow} /> : null}
          </button>

          <button type="button" style={publishType === 'special' ? styles.typeTabActiveSpecial : styles.typeTab} onClick={() => selectPublishType('special')}>
            <span style={styles.typeIconGreen}><Icon name="gift" size={29} /></span>
            <span><strong style={styles.typeTitle}>Contenido gratuito</strong><small style={styles.tabSub}>No descuenta a nadie</small></span>
            {publishType === 'special' ? <span style={styles.activeArrow} /> : null}
          </button>
        </div>

        <div style={publishType === 'daily' ? styles.replayGrid : styles.publishGrid}>
          <div>
            <div style={styles.fieldLabel}>ID de Vimeo</div>
            <div style={styles.inputShell}>
              <span style={styles.inputIconVimeo}><Icon name="vimeo" size={29} /></span>
              <input
                value={vimeoId}
                onChange={(e) => setVimeoId(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej: 1217366012"
                inputMode="numeric"
                style={styles.inputInside}
              />
            </div>
            <div style={styles.fieldHelp}>Ingresa únicamente el número del video de Vimeo.</div>
          </div>

          {(publishType === 'course' || publishType === 'special') && (
            <div>
              <div style={styles.fieldLabel}>{publishType === 'course' ? 'Nombre del curso / clase' : 'Nombre personalizado'}</div>
              <div style={styles.inputShell}>
                <input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder={publishType === 'course' ? 'Ej: Día 2 - Curso Intensivo' : 'Ej: POST-FED del 18 de junio de 2026'}
                  style={{ ...styles.inputInside, paddingLeft: 16 }}
                />
              </div>
              <div style={styles.fieldHelp}>{publishType === 'course' ? 'Se publica exclusivamente para los estudiantes del curso.' : 'Este contenido se publica sin descontar clases.'}</div>
            </div>
          )}

          {publishType === 'daily' && (
            <div>
              <div style={styles.fieldLabel}>Sesión LIVE</div>
              <button type="button" style={styles.sessionButtonLarge} onClick={() => setSessionPickerOpen(true)}>
                <span style={styles.sessionButtonLeft}><span style={styles.broadcastIcon}><Icon name="broadcast" size={27} /></span><span>{selectedSession ? `${formatSessionDate(selectedSession.started_at)} → ${formatSessionDate(selectedSession.ended_at)}` : 'Seleccionar sesión LIVE'}</span></span>
                <span style={{ fontSize: 20, opacity: .9 }}>⌄</span>
              </button>
              <div style={styles.fieldHelp}>Solo se muestran sesiones finalizadas sin repetición publicada.</div>
            </div>
          )}

          <button
            type="button"
            style={{
              ...styles.publishButton,
              opacity:
                !vimeoId ||
                (publishType === 'daily' && !selectedSessionId) ||
                ((publishType === 'course' || publishType === 'special') && !videoTitle.trim())
                  ? .55
                  : 1
            }}
            disabled={
              publishing ||
              !vimeoId ||
              (publishType === 'daily' && !selectedSessionId) ||
              ((publishType === 'course' || publishType === 'special') && !videoTitle.trim())
            }
            onClick={requestPublish}
          >
            <Icon name="send" size={25} /> Publicar
          </button>
        </div>

        {publishType === 'daily' && (
          <div style={styles.publishFoot}>{pendingSessions.length} sesión(es) finalizada(s) pendiente(s) de repetición. Las sesiones ya asociadas no pueden seleccionarse nuevamente.</div>
        )}
        {publishType === 'course' && (
          <div style={styles.publishFoot}>Esta publicación corresponde a course_500 y descuenta según la configuración de INTENSIVE_TWO_DAY.</div>
        )}
        {publishType === 'special' && (
          <div style={styles.publishFoot}>Este contenido es gratuito: se publica como especial y no descuenta clases a ningún estudiante.</div>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>PUBLICAR</div>
        <p style={styles.publishIntro}>Selecciona el tipo de video. El portal aplicará automáticamente las reglas correspondientes.</p>

        <div style={styles.typeTabs}>
          <button type="button" style={publishType === 'daily' ? styles.typeTabActive : styles.typeTab} onClick={() => selectPublishType('daily')}>
            <span style={styles.tabIcon}>▣</span><span><strong>Clase diaria</strong><small style={styles.tabSub}>Desde una sesión LIVE</small></span>
          </button>
          <button type="button" style={publishType === 'course' ? styles.typeTabActive : styles.typeTab} onClick={() => selectPublishType('course')}>
            <span style={styles.tabIcon}>◆</span><span><strong>Curso intensivo</strong><small style={styles.tabSub}>Solo para estudiantes del curso</small></span>
          </button>
          <button type="button" style={publishType === 'special' ? styles.typeTabActive : styles.typeTab} onClick={() => selectPublishType('special')}>
            <span style={styles.tabIcon}>✦</span><span><strong>Contenido gratuito</strong><small style={styles.tabSub}>No descuenta a nadie</small></span>
          </button>
        </div>

        <div style={publishType === 'daily' ? styles.replayGrid : styles.publishGrid}>
          <div>
            <div style={styles.fieldLabel}>ID de Vimeo</div>
            <input
              value={vimeoId}
              onChange={(e) => setVimeoId(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej. 1217366012"
              inputMode="numeric"
              style={{ ...styles.input, width: '100%', minWidth: 0, boxSizing: 'border-box' }}
            />
            <div style={styles.fieldHelp}>Ingresa únicamente el número del video de Vimeo.</div>
          </div>

          {(publishType === 'course' || publishType === 'special') && (
            <div>
              <div style={styles.fieldLabel}>{publishType === 'course' ? 'Nombre del curso / clase' : 'Nombre personalizado'}</div>
              <input
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder={publishType === 'course' ? 'Ej. Día 2 - Curso Intensivo' : 'Ej. POST-FED del 18 de junio de 2026'}
                style={{ ...styles.input, width: '100%', minWidth: 0, boxSizing: 'border-box' }}
              />
            </div>
          )}

          {publishType === 'daily' && (
            <div>
              <div style={styles.fieldLabel}>Sesión LIVE</div>
              <button type="button" style={styles.sessionButton} onClick={() => setSessionPickerOpen(true)}>
                <span>{selectedSession ? `${formatSessionDate(selectedSession.started_at)} → ${formatSessionDate(selectedSession.ended_at)}` : 'Seleccionar sesión LIVE'}</span>
                <span>▾</span>
              </button>
              <div style={styles.fieldHelp}>Solo se muestran sesiones finalizadas sin repetición publicada.</div>
            </div>
          )}

          <button
            type="button"
            style={{
              ...styles.button,
              alignSelf: 'end',
              opacity:
                !vimeoId ||
                (publishType === 'daily' && !selectedSessionId) ||
                ((publishType === 'course' || publishType === 'special') && !videoTitle.trim())
                  ? .55
                  : 1
            }}
            disabled={
              publishing ||
              !vimeoId ||
              (publishType === 'daily' && !selectedSessionId) ||
              ((publishType === 'course' || publishType === 'special') && !videoTitle.trim())
            }
            onClick={requestPublish}
          >
            ✈ Publicar
          </button>
        </div>

        {publishType === 'daily' && (
          <div style={styles.mutedSmall}>{pendingSessions.length} sesión(es) finalizada(s) pendiente(s) de repetición. Las sesiones ya asociadas no pueden seleccionarse nuevamente.</div>
        )}
        {publishType === 'course' && (
          <div style={styles.mutedSmall}>Esta publicación corresponde a course_500 y descuenta según la configuración de INTENSIVE_TWO_DAY.</div>
        )}
        {publishType === 'special' && (
          <div style={styles.mutedSmall}>Este contenido es gratuito: se publica como especial y no descuenta clases a ningún estudiante.</div>
        )}
      </div>

      <div style={styles.studentsCard}>
        <div style={styles.studentsHeader}>
          <div>
            <div style={styles.sectionTitle}>ESTUDIANTES</div>
            <h2 style={styles.studentsTitle}>Control académico</h2>
          </div>
          <div style={styles.searchShell}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre o correo..." style={styles.searchInput} />
            <span style={styles.searchIcon}><Icon name="search" size={22} /></span>
          </div>
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
                      <div style={styles.studentIdentity}>
                        <div style={styles.avatar}>{initialsForName(row.full_name)}</div>
                        <div>
                          <div style={styles.studentName}>{formatPersonName(row.full_name)}</div>
                          <div style={styles.studentEmail}>{row.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}><span style={row.is_paused ? styles.pillPaused : styles.pillActive}>{row.is_paused ? '⏸ PAUSADO' : '● ACTIVO'}</span></td>
                    <td style={styles.td}><strong style={styles.balanceMain}>{row.remaining_classes} restantes</strong><div style={styles.studentEmail}>{row.classes_used}/{row.total_classes} usadas</div></td>
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
      {publishConfirmOpen && (publishType !== 'daily' || selectedSession) && (
        <div style={styles.modalBackdrop} onMouseDown={() => !publishing && setPublishConfirmOpen(false)}>
          <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={styles.eyebrow}>CONFIRMAR PUBLICACIÓN</div>
            <h2 style={{ margin: '6px 0 8px' }}>
              {publishType === 'daily' ? 'Publicar repetición diaria' : publishType === 'course' ? 'Publicar curso intensivo' : 'Publicar contenido gratuito'}
            </h2>

            <div style={styles.confirmBox}>
              <div><span style={styles.mutedSmall}>Tipo</span><br /><strong>{publishType === 'daily' ? 'Clase diaria' : publishType === 'course' ? 'Curso intensivo' : 'Contenido gratuito'}</strong></div>
              {(publishType === 'course' || publishType === 'special') && (
                <div><span style={styles.mutedSmall}>Nombre</span><br /><strong>{videoTitle.trim()}</strong></div>
              )}
              <div><span style={styles.mutedSmall}>Vimeo</span><br /><strong>{vimeoId}</strong></div>
              {publishType === 'daily' && selectedSession && (
                <div><span style={styles.mutedSmall}>Sesión LIVE</span><br /><strong>{formatSessionDate(selectedSession.started_at)}</strong><br /><span style={styles.mutedSmall}>hasta {formatSessionDate(selectedSession.ended_at)}</span></div>
              )}
            </div>

            <p style={styles.muted}>
              {publishType === 'daily'
                ? 'La repetición quedará asociada a esta sesión LIVE y se ejecutará el mecanismo de consumo validado para asistencia y pausas.'
                : publishType === 'course'
                  ? 'Esta publicación ejecutará el consumo configurado exclusivamente para los accesos INTENSIVE_TWO_DAY con saldo disponible.'
                  : 'Esta publicación será contenido especial gratuito y no descontará clases a ningún estudiante.'}
            </p>

            <div style={styles.modalActions}>
              <button disabled={publishing} style={styles.buttonSecondary} onClick={() => setPublishConfirmOpen(false)}>Cancelar</button>
              <button disabled={publishing} style={styles.button} onClick={publishVideo}>
                {publishing ? 'Publicando...' : 'Confirmar publicación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const styles: Record<string, any> = {
  page: {
    minHeight: '100vh',
    padding: '28px 4.5vw 44px',
    color: '#f8fbff',
    background: 'radial-gradient(circle at 48% 0%, rgba(0,102,204,.13), transparent 31%), linear-gradient(180deg, rgba(2,7,18,.90), rgba(2,8,20,.97)), url("/trading-bg.jpg") center/cover fixed',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
  },
  header: {
    maxWidth: 1500,
    margin: '0 auto 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap'
  },
  eyebrow: { fontSize: 12, letterSpacing: 1.4, fontWeight: 900, opacity: .72 },
  eyebrowBlue: { fontSize: 13, letterSpacing: 1.1, fontWeight: 900, color: '#2593ff', marginBottom: 5 },
  pageTitle: { margin: 0, fontSize: 34, lineHeight: 1.08, letterSpacing: '-.7px', fontWeight: 950 },
  pageSubtitle: { color: 'rgba(255,255,255,.82)', margin: '8px 0 0', fontSize: 16, lineHeight: 1.4 },
  muted: { color: 'rgba(255,255,255,.79)', margin: '8px 0 0', lineHeight: 1.55, fontSize: 15 },
  mutedSmall: { color: 'rgba(255,255,255,.70)', fontSize: 13, marginTop: 5, lineHeight: 1.45 },

  dashboardButton: {
    padding: '12px 18px',
    minHeight: 46,
    borderRadius: 11,
    border: '1px solid #1680ff',
    background: 'rgba(4,18,39,.68)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 0 0 1px rgba(22,128,255,.10) inset'
  },

  stats: {
    maxWidth: 1500,
    margin: '0 auto 18px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
    gap: 14
  },
  statCard: {
    minHeight: 84,
    padding: '14px 18px',
    border: '1px solid rgba(118,163,213,.24)',
    borderRadius: 18,
    background: 'linear-gradient(180deg,rgba(7,20,40,.88),rgba(7,16,32,.80))',
    boxShadow: '0 18px 40px rgba(0,0,0,.15)',
    display: 'flex',
    alignItems: 'center',
    gap: 16
  },
  statNumber: { display: 'block', fontSize: 27, lineHeight: 1, fontWeight: 950, marginBottom: 7 },
  statLabel: { fontSize: 15, fontWeight: 750, color: 'rgba(255,255,255,.92)' },
  statIconBlue: { width: 54, height: 54, borderRadius: 14, display: 'grid', placeItems: 'center', color: '#5eb4ff', background: 'rgba(15,93,190,.20)', border: '1px solid rgba(29,124,255,.52)' },
  statIconGreen: { width: 54, height: 54, borderRadius: 14, display: 'grid', placeItems: 'center', color: '#15e58e', background: 'rgba(0,121,75,.20)', border: '1px solid rgba(0,193,120,.45)' },
  statIconAmber: { width: 54, height: 54, borderRadius: 14, display: 'grid', placeItems: 'center', color: '#ffad12', background: 'rgba(151,88,0,.22)', border: '1px solid rgba(234,144,0,.50)' },
  statIconPurple: { width: 54, height: 54, borderRadius: 14, display: 'grid', placeItems: 'center', color: '#c47cff', background: 'rgba(94,42,139,.24)', border: '1px solid rgba(150,78,213,.42)' },

  publishCard: {
    maxWidth: 1500,
    margin: '0 auto 18px',
    border: '1px solid rgba(118,163,213,.26)',
    borderRadius: 19,
    padding: '22px 24px 18px',
    background: 'linear-gradient(180deg,rgba(4,20,39,.91),rgba(4,14,29,.88))',
    boxShadow: '0 22px 55px rgba(0,0,0,.22)',
    backdropFilter: 'blur(12px)'
  },
  sectionTitle: { fontSize: 14, letterSpacing: 1.05, fontWeight: 950, color: '#1993ff' },
  publishIntro: { color: 'rgba(255,255,255,.96)', fontSize: 17, fontWeight: 750, margin: '8px 0 0', lineHeight: 1.45 },

  typeTabs: { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 14, marginTop: 16 },
  typeTab: {
    position: 'relative',
    minHeight: 96,
    padding: '16px 19px',
    borderRadius: 14,
    border: '1px solid rgba(113,153,198,.34)',
    background: 'linear-gradient(180deg,rgba(2,13,28,.72),rgba(4,17,34,.58))',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    textAlign: 'left'
  },
  typeTabActive: {
    position: 'relative',
    minHeight: 96,
    padding: '16px 19px',
    borderRadius: 14,
    border: '2px solid #1685ff',
    background: 'linear-gradient(135deg,rgba(21,105,219,.24),rgba(6,20,40,.70))',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    textAlign: 'left',
    boxShadow: '0 0 0 1px rgba(28,123,255,.10) inset, 0 10px 30px rgba(0,82,180,.10)'
  },
  typeTabActiveCourse: {
    position: 'relative',
    minHeight: 96,
    padding: '16px 19px',
    borderRadius: 14,
    border: '2px solid #1685ff',
    background: 'linear-gradient(135deg,rgba(21,105,219,.24),rgba(6,20,40,.70))',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    textAlign: 'left'
  },
  typeTabActiveSpecial: {
    position: 'relative',
    minHeight: 96,
    padding: '16px 19px',
    borderRadius: 14,
    border: '2px solid #1685ff',
    background: 'linear-gradient(135deg,rgba(21,105,219,.24),rgba(6,20,40,.70))',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    textAlign: 'left'
  },
  activeArrow: {
    position: 'absolute',
    left: '50%',
    bottom: -12,
    width: 0,
    height: 0,
    borderLeft: '12px solid transparent',
    borderRight: '12px solid transparent',
    borderTop: '12px solid #1685ff',
    transform: 'translateX(-50%)'
  },
  typeTitle: { display: 'block', fontSize: 18, lineHeight: 1.2, fontWeight: 900, marginBottom: 5 },
  tabSub: { display: 'block', fontSize: 15, lineHeight: 1.3, fontWeight: 500, color: 'rgba(255,255,255,.78)' },
  typeIconBlue: { width: 50, height: 50, borderRadius: 13, display: 'grid', placeItems: 'center', color: '#8bc5ff', background: 'rgba(15,76,158,.23)', border: '1px solid rgba(49,125,255,.48)', flex: '0 0 auto' },
  typeIconAmber: { width: 50, height: 50, borderRadius: 13, display: 'grid', placeItems: 'center', color: '#ff9d20', background: 'rgba(111,62,0,.25)', border: '1px solid rgba(188,104,0,.43)', flex: '0 0 auto' },
  typeIconGreen: { width: 50, height: 50, borderRadius: 13, display: 'grid', placeItems: 'center', color: '#19e493', background: 'rgba(0,91,59,.24)', border: '1px solid rgba(0,174,110,.40)', flex: '0 0 auto' },

  replayGrid: { display: 'grid', gridTemplateColumns: 'minmax(300px,.95fr) minmax(390px,1.25fr) 200px', gap: 20, alignItems: 'end', marginTop: 20 },
  publishGrid: { display: 'grid', gridTemplateColumns: 'minmax(300px,.95fr) minmax(390px,1.25fr) 200px', gap: 20, alignItems: 'end', marginTop: 20 },
  fieldLabel: { fontSize: 15, fontWeight: 900, color: 'rgba(255,255,255,.96)', margin: '0 0 8px' },
  fieldHelp: { color: 'rgba(255,255,255,.72)', fontSize: 14, marginTop: 7, lineHeight: 1.35 },
  publishFoot: { color: 'rgba(255,255,255,.64)', fontSize: 13, marginTop: 10, lineHeight: 1.4 },

  inputShell: {
    minHeight: 51,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 11,
    border: '1px solid rgba(123,163,207,.34)',
    background: 'linear-gradient(180deg,rgba(12,28,50,.90),rgba(8,21,40,.88))',
    overflow: 'hidden'
  },
  inputIconVimeo: { width: 56, display: 'grid', placeItems: 'center', color: '#20a7ff', flex: '0 0 auto' },
  inputInside: { flex: 1, minWidth: 0, height: 50, border: 0, outline: 'none', background: 'transparent', color: '#fff', fontSize: 16, padding: '0 16px 0 0', fontFamily: 'inherit' },

  sessionButtonLarge: {
    width: '100%',
    minHeight: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '0 16px',
    borderRadius: 11,
    border: '1px solid rgba(123,163,207,.34)',
    background: 'linear-gradient(180deg,rgba(12,28,50,.90),rgba(8,21,40,.88))',
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
    textAlign: 'left'
  },
  sessionButtonLeft: { display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 },
  broadcastIcon: { color: '#1aa7ff', display: 'grid', placeItems: 'center' },

  publishButton: {
    minHeight: 54,
    width: 200,
    borderRadius: 10,
    border: 0,
    background: 'linear-gradient(180deg,#188cff,#0767e6)',
    color: '#fff',
    fontSize: 18,
    fontWeight: 950,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: '0 12px 28px rgba(0,93,218,.26)'
  },

  studentsCard: {
    maxWidth: 1500,
    margin: '0 auto 20px',
    border: '1px solid rgba(118,163,213,.26)',
    borderRadius: 19,
    padding: '18px 22px 8px',
    background: 'linear-gradient(180deg,rgba(4,20,39,.91),rgba(4,14,29,.88))',
    boxShadow: '0 22px 55px rgba(0,0,0,.18)',
    backdropFilter: 'blur(12px)'
  },
  studentsHeader: { display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 10 },
  studentsTitle: { margin: '5px 0 0', fontSize: 25, lineHeight: 1.15, fontWeight: 950 },
  searchShell: { width: 340, display: 'flex', border: '1px solid rgba(123,163,207,.32)', background: 'rgba(7,20,39,.78)', borderRadius: 11, overflow: 'hidden' },
  searchInput: { flex: 1, minWidth: 0, height: 46, padding: '0 14px', border: 0, outline: 'none', background: 'transparent', color: '#fff', fontSize: 14, fontFamily: 'inherit' },
  searchIcon: { width: 52, borderLeft: '1px solid rgba(123,163,207,.20)', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.72)' },

  table: { width: '100%', borderCollapse: 'collapse', minWidth: 1080 },
  th: { textAlign: 'left', padding: '11px 10px', color: 'rgba(255,255,255,.72)', fontSize: 14, fontWeight: 800, borderBottom: '1px solid rgba(118,163,213,.20)' },
  td: { padding: '10px 10px', borderTop: '1px solid rgba(118,163,213,.16)', verticalAlign: 'middle', fontSize: 14 },
  studentIdentity: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(180deg,#2384ff,#075ecc)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 15, boxShadow: '0 8px 18px rgba(0,92,214,.20)' },
  studentName: { fontSize: 15.5, fontWeight: 900, color: '#fff', lineHeight: 1.25 },
  studentEmail: { color: 'rgba(255,255,255,.72)', fontSize: 12.5, marginTop: 3 },
  balanceMain: { fontSize: 15.5, fontWeight: 900 },

  pillActive: { display: 'inline-block', padding: '6px 11px', borderRadius: 999, background: 'rgba(0,141,89,.18)', border: '1px solid rgba(0,202,125,.45)', color: '#d6fff0', fontSize: 12.5, fontWeight: 900 },
  pillPaused: { display: 'inline-block', padding: '6px 11px', borderRadius: 999, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.42)', color: '#fde68a', fontSize: 12.5, fontWeight: 900 },

  action: { padding: '9px 13px', minHeight: 38, borderRadius: 9, border: '1px solid rgba(123,163,207,.32)', background: 'linear-gradient(180deg,rgba(14,29,51,.92),rgba(8,20,39,.92))', color: '#fff', fontSize: 13.5, fontWeight: 750, cursor: 'pointer' },
  actionPrimary: { padding: '9px 13px', minHeight: 38, borderRadius: 9, border: '1px solid rgba(34,197,94,.35)', background: 'rgba(34,197,94,.16)', color: '#dcfce7', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' },
  actionWarn: { padding: '9px 13px', minHeight: 38, borderRadius: 9, border: '1px solid rgba(245,158,11,.60)', background: 'linear-gradient(180deg,rgba(108,62,0,.42),rgba(65,39,0,.35))', color: '#fff1c3', fontSize: 13.5, fontWeight: 850, cursor: 'pointer' },

  input: { minWidth: 300, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff', outline: 'none' },
  textarea: { width: '100%', minHeight: 110, resize: 'vertical', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff', outline: 'none', font: 'inherit' },

  button: { padding: '12px 20px', minHeight: 46, borderRadius: 10, border: 0, background: 'linear-gradient(180deg,#2583f8,#1264d9)', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer', boxShadow: '0 8px 20px rgba(37,99,235,.18)' },
  buttonSecondary: { padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  notice: { padding: '11px 13px', borderRadius: 12, marginBottom: 12, background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.28)', fontSize: 14 },

  modalBackdrop: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(2,6,23,.82)', backdropFilter: 'blur(8px)' },
  modal: { width: 'min(680px, 100%)', maxHeight: '85vh', overflowY: 'auto', border: '1px solid rgba(118,163,213,.26)', borderRadius: 22, padding: 22, background: '#081326', boxShadow: '0 30px 90px rgba(0,0,0,.55)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' },
  closeButton: { width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#fff', fontSize: 24, lineHeight: 1, cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  sessionList: { display: 'grid', gap: 9, marginTop: 16 },
  sessionOption: { display: 'grid', gap: 4, width: '100%', padding: '13px 14px', borderRadius: 13, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)', color: '#fff', textAlign: 'left', cursor: 'pointer' },
  sessionOptionSelected: { display: 'grid', gap: 4, width: '100%', padding: '13px 14px', borderRadius: 13, border: '1px solid rgba(59,130,246,.55)', background: 'rgba(37,99,235,.18)', color: '#fff', textAlign: 'left', cursor: 'pointer' },
  empty: { padding: 18, borderRadius: 12, background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.65)' },
  confirmBox: { display: 'grid', gap: 14, marginTop: 16, padding: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(255,255,255,.04)' }
};

