import { useEffect, useMemo, useState } from 'react';
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

type IconName = 'shield' | 'cap' | 'lock' | 'video' | 'refresh' | 'clock' | 'pause' | 'play';

function Icon({ name, size = 28 }: { name: IconName; size?: number }) {
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

  if (name === 'shield') return <svg {...common}><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (name === 'cap') return <svg {...common}><path d="M3 10 12 5l9 5-9 5z"/><path d="M7 12v5c3 2 7 2 10 0v-5"/><path d="M21 10v6"/></svg>;
  if (name === 'lock') return <svg {...common}><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
  if (name === 'video') return <svg {...common}><rect x="4" y="6" width="13" height="12" rx="2"/><path d="m17 10 4-2v8l-4-2z"/></svg>;
  if (name === 'refresh') return <svg {...common}><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.5 8a7 7 0 0 1 11.5-1L20 12"/><path d="M17.5 16a7 7 0 0 1-11.5 1L4 12"/></svg>;
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  if (name === 'pause') return <svg {...common}><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
  return <svg {...common}><path d="m8 5 11 7-11 7z"/></svg>;
}

export default function MisClasesPage() {
  const router = useRouter();
  const [control, setControl] = useState<Control | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pauseModal, setPauseModal] = useState<boolean | null>(null);

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

    setWorking(true);
    setMessage(null);

    const { error } = await supabase.rpc('student_set_class_pause', { p_pause: pause });
    setWorking(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setPauseModal(null);
    setMessage(pause ? 'Tus clases quedaron pausadas.' : 'Tus clases quedaron reactivadas.');
    await load();
  }

  const progress = useMemo(() => {
    if (!control || control.total_classes <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((control.classes_used / control.total_classes) * 100)));
  }, [control]);

  if (loading) {
    return <main style={styles.page}><div style={styles.loadingCard}>Cargando tus clases...</div></main>;
  }

  return (
    <main style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrowBlue}>LEAD ACADEMY</div>
            <h1 style={styles.pageTitle}>Mis clases</h1>
            <p style={styles.pageSubtitle}>Controla tu saldo y el estado de tus próximas clases.</p>
          </div>
          <button style={styles.portalButton} onClick={() => router.push('/dashboard')}>
            ←&nbsp; Volver a Mi portal
          </button>
        </div>

        {!control ? (
          <div style={styles.card}>
            <h2 style={{ marginTop: 0 }}>No se pudo cargar tu control de clases</h2>
            {message ? <p style={styles.error}>{message}</p> : null}
          </div>
        ) : (
          <>
            <div style={styles.heroGrid}>
              <section style={styles.heroCard}>
                <div style={styles.heroIconShield}>
                  <Icon name="shield" size={42} />
                </div>

                <div style={styles.heroContent}>
                  <div style={styles.eyebrow}>ESTADO</div>
                  <div style={control.is_paused ? styles.bigPaused : styles.bigActive}>
                    {control.is_paused ? '⏸ PAUSADO' : '● ACTIVO'}
                  </div>
                  <p style={styles.heroText}>
                    {control.is_paused
                      ? 'Tu saldo permanece protegido para clases futuras.'
                      : 'Las próximas clases se descuentan normalmente según las reglas del portal.'}
                  </p>

                  {control.is_paused ? (
                    <button disabled={working} style={styles.primary} onClick={() => setPauseModal(false)}>
                      <Icon name="play" size={19} />
                      {working ? 'Procesando...' : 'Reactivar mis clases'}
                    </button>
                  ) : (
                    <button disabled={working} style={styles.warn} onClick={() => setPauseModal(true)}>
                      <Icon name="pause" size={18} />
                      {working ? 'Procesando...' : 'Pausar mis clases'}
                    </button>
                  )}
                </div>
              </section>

              <section style={styles.heroCard}>
                <div style={styles.heroIconCap}>
                  <Icon name="cap" size={43} />
                </div>

                <div style={styles.heroContent}>
                  <div style={styles.eyebrow}>SALDO</div>
                  <div style={styles.balance}>{control.remaining_classes}</div>
                  <div style={styles.balanceLabel}>clases restantes</div>
                  <p style={styles.heroText}>{control.classes_used} utilizadas de {control.total_classes} contratadas.</p>

                  <div style={styles.progressRow}>
                    <div style={styles.progressTrack}>
                      <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                    </div>
                    <div style={styles.progressValue}>{progress}%</div>
                  </div>
                </div>
              </section>
            </div>

            {message ? <div style={styles.notice}>{message}</div> : null}

            <section style={styles.rulesCard}>
              <div style={styles.sectionLabel}>REGLAS DE PAUSA</div>
              <h2 style={styles.sectionTitle}>Cómo funciona</h2>

              <div style={styles.ruleGrid}>
                <div style={styles.ruleItem}>
                  <div style={styles.ruleIconBlue}><Icon name="lock" size={28} /></div>
                  <div>
                    <div style={styles.ruleTitle}>Tu saldo queda protegido</div>
                    <div style={styles.ruleText}>Mientras estés pausado, tus clases restantes no se consumirán.</div>
                  </div>
                </div>

                <div style={styles.ruleItemMiddle}>
                  <div style={styles.ruleIconAmber}><Icon name="video" size={27} /></div>
                  <div>
                    <div style={styles.ruleTitle}>Las nuevas clases no estarán incluidas</div>
                    <div style={styles.ruleText}>Las clases realizadas durante la pausa no generarán acceso gratuito a sus repeticiones.</div>
                  </div>
                </div>

                <div style={styles.ruleItem}>
                  <div style={styles.ruleIconGreen}><Icon name="refresh" size={29} /></div>
                  <div>
                    <div style={styles.ruleTitle}>Puedes reactivar cuando quieras</div>
                    <div style={styles.ruleText}>Al reactivar, tus clases volverán a descontarse normalmente según las reglas del portal.</div>
                  </div>
                </div>
              </div>
            </section>

            <section style={styles.securityCard}>
              <div style={styles.securityMain}>
                <div style={styles.sectionLabel}>SEGURIDAD</div>
                <div style={styles.securityRow}>
                  <div style={styles.ruleIconBlue}><Icon name="shield" size={29} /></div>
                  <div>
                    <div style={styles.securityTitle}>El estado se guarda en la base de datos con fecha y hora del servidor.</div>
                    <div style={styles.ruleText}>
                      Cerrar el navegador, cambiar de equipo o modificar la hora local no altera el historial de pausa/reanudación.
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.securityNote}>
                <div style={styles.noteTitle}><Icon name="clock" size={22} /> Nota importante</div>
                <div style={styles.noteText}>Tu saldo y estado siempre reflejan la información oficial del servidor.</div>
              </div>
            </section>
          </>
        )}
      </div>

      {pauseModal !== null && control ? (
        <div style={styles.modalBackdrop} onMouseDown={() => !working && setPauseModal(null)}>
          <div style={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div style={styles.modalTop}>
              <div>
                <div style={styles.sectionLabel}>{pauseModal ? 'PAUSAR CLASES' : 'REACTIVAR CLASES'}</div>
                <h2 style={styles.modalTitle}>{pauseModal ? 'Confirmar pausa' : 'Confirmar reactivación'}</h2>
              </div>
              <button style={styles.modalClose} onClick={() => !working && setPauseModal(null)}>×</button>
            </div>

            {pauseModal ? (
              <div style={styles.modalRuleList}>
                <div style={styles.modalRule}>
                  <div style={styles.modalRuleIconBlue}><Icon name="lock" size={23} /></div>
                  <div>
                    <div style={styles.modalRuleTitle}>Tu saldo queda protegido</div>
                    <div style={styles.modalRuleText}>Tus {control.remaining_classes} clases restantes no se consumirán mientras estés pausado.</div>
                  </div>
                </div>

                <div style={styles.modalRule}>
                  <div style={styles.modalRuleIconAmber}><Icon name="video" size={22} /></div>
                  <div>
                    <div style={styles.modalRuleTitle}>Las nuevas clases no estarán incluidas</div>
                    <div style={styles.modalRuleText}>Las clases realizadas durante la pausa no generarán acceso gratuito a sus repeticiones.</div>
                  </div>
                </div>

                <div style={styles.modalRule}>
                  <div style={styles.modalRuleIconGreen}><Icon name="refresh" size={23} /></div>
                  <div>
                    <div style={styles.modalRuleTitle}>Puedes reactivar cuando quieras</div>
                    <div style={styles.modalRuleText}>Al reactivar, las clases volverán a descontarse normalmente.</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={styles.resumeBox}>
                <div style={styles.modalRuleIconGreen}><Icon name="refresh" size={25} /></div>
                <div>
                  <div style={styles.modalRuleTitle}>Tus próximas clases volverán a estar activas</div>
                  <div style={styles.modalRuleText}>Al reactivar, las próximas clases volverán a ser cobrables según las reglas del portal.</div>
                </div>
              </div>
            )}

            <div style={styles.modalActions}>
              <button disabled={working} style={styles.secondary} onClick={() => setPauseModal(null)}>Cancelar</button>
              <button
                disabled={working}
                style={pauseModal ? styles.warn : styles.primary}
                onClick={() => changePause(pauseModal)}
              >
                {pauseModal ? <Icon name="pause" size={18} /> : <Icon name="play" size={18} />}
                {working ? 'Procesando...' : pauseModal ? 'Sí, pausar mis clases' : 'Sí, reactivar mis clases'}
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
    padding: '28px 5vw 48px',
    color: '#f8fbff',
    background: 'radial-gradient(circle at 55% 0%, rgba(6,99,196,.12), transparent 34%), linear-gradient(180deg, rgba(2,7,18,.90), rgba(2,8,20,.97)), url("/trading-bg.jpg") center/cover fixed',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  },
  wrap: { maxWidth: 1500, margin: '0 auto' },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  eyebrow: { fontSize: 14, letterSpacing: 1.2, fontWeight: 900, color: 'rgba(255,255,255,.76)' },
  eyebrowBlue: { fontSize: 15, letterSpacing: 1.1, fontWeight: 900, color: '#4099ff', marginBottom: 6 },
  pageTitle: { margin: 0, fontSize: 40, lineHeight: 1.05, letterSpacing: '-.8px', fontWeight: 950 },
  pageSubtitle: { margin: '10px 0 0', color: 'rgba(255,255,255,.82)', fontSize: 18, lineHeight: 1.45 },
  portalButton: {
    minHeight: 52,
    padding: '0 22px',
    borderRadius: 12,
    border: '1px solid #247eff',
    background: 'rgba(5,18,38,.72)',
    color: '#fff',
    fontSize: 16,
    fontWeight: 900,
    cursor: 'pointer',
  },

  heroGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  heroCard: {
    minHeight: 250,
    border: '1px solid rgba(116,163,214,.25)',
    borderRadius: 20,
    padding: 34,
    background: 'linear-gradient(180deg,rgba(4,20,39,.90),rgba(4,14,29,.86))',
    boxShadow: '0 22px 55px rgba(0,0,0,.18)',
    display: 'flex',
    alignItems: 'center',
    gap: 28,
  },
  heroContent: { flex: 1, minWidth: 0 },
  heroIconShield: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    color: '#22e29a',
    background: 'rgba(0,117,72,.18)',
    border: '1px solid rgba(0,194,119,.42)',
    flex: '0 0 auto',
  },
  heroIconCap: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    color: '#3f85ff',
    background: 'rgba(31,85,184,.16)',
    border: '1px solid rgba(46,109,226,.44)',
    flex: '0 0 auto',
  },
  bigActive: { fontSize: 42, lineHeight: 1.05, fontWeight: 950, color: '#34e09a', marginTop: 12 },
  bigPaused: { fontSize: 42, lineHeight: 1.05, fontWeight: 950, color: '#ffd36a', marginTop: 12 },
  heroText: { color: 'rgba(255,255,255,.82)', lineHeight: 1.55, margin: '14px 0 0', fontSize: 18, maxWidth: 470 },
  balance: { fontSize: 78, lineHeight: .95, fontWeight: 950, marginTop: 12, letterSpacing: '-2px' },
  balanceLabel: { fontSize: 22, fontWeight: 900, marginTop: 4 },
  progressRow: { display: 'flex', gap: 18, alignItems: 'center', marginTop: 24 },
  progressTrack: { flex: 1, height: 18, borderRadius: 999, background: 'rgba(93,116,151,.26)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#33e29b,#4cd98b)' },
  progressValue: { color: '#28e397', fontSize: 24, fontWeight: 950, minWidth: 58, textAlign: 'right' },

  primary: {
    marginTop: 24,
    minHeight: 50,
    padding: '0 20px',
    borderRadius: 10,
    border: '1px solid rgba(34,197,94,.45)',
    background: 'rgba(20,137,77,.16)',
    color: '#d9ffec',
    fontSize: 16,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  warn: {
    marginTop: 24,
    minHeight: 50,
    padding: '0 20px',
    borderRadius: 10,
    border: '1px solid rgba(245,158,11,.58)',
    background: 'linear-gradient(180deg,rgba(105,64,0,.38),rgba(64,39,0,.34))',
    color: '#ffe3a2',
    fontSize: 16,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  notice: {
    border: '1px solid rgba(59,130,246,.30)',
    borderRadius: 14,
    padding: 14,
    background: 'rgba(59,130,246,.12)',
    marginBottom: 16,
    fontSize: 15,
  },

  rulesCard: {
    border: '1px solid rgba(116,163,214,.25)',
    borderRadius: 20,
    padding: '28px 28px 26px',
    background: 'linear-gradient(180deg,rgba(4,20,39,.90),rgba(4,14,29,.86))',
    boxShadow: '0 22px 55px rgba(0,0,0,.16)',
    marginBottom: 16,
  },
  sectionLabel: { fontSize: 14, letterSpacing: 1.15, fontWeight: 950, color: '#429cff' },
  sectionTitle: { margin: '8px 0 18px', fontSize: 29, lineHeight: 1.15, fontWeight: 950 },
  ruleGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0 },
  ruleItem: { display: 'flex', gap: 18, alignItems: 'flex-start', padding: '8px 24px 8px 0' },
  ruleItemMiddle: { display: 'flex', gap: 18, alignItems: 'flex-start', padding: '8px 24px', borderLeft: '1px solid rgba(116,163,214,.18)', borderRight: '1px solid rgba(116,163,214,.18)' },
  ruleIconBlue: { width: 58, height: 58, borderRadius: '50%', flex: '0 0 auto', display: 'grid', placeItems: 'center', color: '#4d8cff', background: 'rgba(31,76,168,.17)', border: '1px solid rgba(49,104,226,.40)' },
  ruleIconAmber: { width: 58, height: 58, borderRadius: '50%', flex: '0 0 auto', display: 'grid', placeItems: 'center', color: '#ffae19', background: 'rgba(111,64,0,.18)', border: '1px solid rgba(190,108,0,.38)' },
  ruleIconGreen: { width: 58, height: 58, borderRadius: '50%', flex: '0 0 auto', display: 'grid', placeItems: 'center', color: '#25dc91', background: 'rgba(0,96,60,.17)', border: '1px solid rgba(0,180,111,.38)' },
  ruleTitle: { fontSize: 18, fontWeight: 950, lineHeight: 1.3, marginBottom: 7 },
  ruleText: { color: 'rgba(255,255,255,.77)', fontSize: 16, lineHeight: 1.55 },

  securityCard: {
    border: '1px solid rgba(116,163,214,.25)',
    borderRadius: 20,
    padding: 28,
    background: 'linear-gradient(180deg,rgba(4,20,39,.90),rgba(4,14,29,.86))',
    boxShadow: '0 22px 55px rgba(0,0,0,.14)',
    display: 'grid',
    gridTemplateColumns: '1.7fr .9fr',
    gap: 28,
  },
  securityMain: { minWidth: 0 },
  securityRow: { display: 'flex', gap: 18, alignItems: 'center', marginTop: 18 },
  securityTitle: { fontSize: 18, fontWeight: 850, lineHeight: 1.4, marginBottom: 5 },
  securityNote: {
    border: '1px solid rgba(116,163,214,.22)',
    borderRadius: 16,
    background: 'rgba(25,32,66,.55)',
    padding: 22,
    alignSelf: 'center',
  },
  noteTitle: { display: 'flex', gap: 10, alignItems: 'center', fontSize: 18, fontWeight: 950, marginBottom: 10 },
  noteText: { color: 'rgba(255,255,255,.73)', fontSize: 16, lineHeight: 1.5 },

  secondary: {
    minHeight: 46,
    padding: '0 17px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,.16)',
    background: 'rgba(255,255,255,.05)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 850,
    cursor: 'pointer',
  },
  error: { color: '#fecaca' },
  loadingCard: { maxWidth: 900, margin: '120px auto', border: '1px solid rgba(255,255,255,.12)', borderRadius: 18, padding: 24, background: '#081326' },

  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'grid',
    placeItems: 'center',
    padding: 20,
    background: 'rgba(2,6,23,.82)',
    backdropFilter: 'blur(8px)',
  },
  modal: {
    width: 'min(620px, 100%)',
    border: '1px solid rgba(116,163,214,.28)',
    borderRadius: 22,
    padding: 26,
    background: '#071227',
    boxShadow: '0 28px 90px rgba(0,0,0,.58)',
  },
  modalTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,.13)',
    background: 'rgba(255,255,255,.05)',
    color: '#fff',
    fontSize: 23,
    cursor: 'pointer',
  },
  modalTitle: { margin: '7px 0 0', fontSize: 28, lineHeight: 1.15, fontWeight: 950 },
  modalRuleList: { display: 'grid', gap: 14, marginTop: 24 },
  modalRule: { display: 'flex', gap: 14, alignItems: 'flex-start', padding: 15, borderRadius: 14, background: 'rgba(255,255,255,.035)', border: '1px solid rgba(116,163,214,.14)' },
  modalRuleIconBlue: { width: 44, height: 44, borderRadius: '50%', flex: '0 0 auto', display: 'grid', placeItems: 'center', color: '#4d8cff', background: 'rgba(31,76,168,.18)', border: '1px solid rgba(49,104,226,.38)' },
  modalRuleIconAmber: { width: 44, height: 44, borderRadius: '50%', flex: '0 0 auto', display: 'grid', placeItems: 'center', color: '#ffae19', background: 'rgba(111,64,0,.18)', border: '1px solid rgba(190,108,0,.38)' },
  modalRuleIconGreen: { width: 44, height: 44, borderRadius: '50%', flex: '0 0 auto', display: 'grid', placeItems: 'center', color: '#25dc91', background: 'rgba(0,96,60,.18)', border: '1px solid rgba(0,180,111,.38)' },
  modalRuleTitle: { fontSize: 16, fontWeight: 950, marginBottom: 4 },
  modalRuleText: { color: 'rgba(255,255,255,.74)', fontSize: 14.5, lineHeight: 1.5 },
  resumeBox: { display: 'flex', gap: 14, alignItems: 'flex-start', marginTop: 24, padding: 16, borderRadius: 14, background: 'rgba(0,96,60,.10)', border: '1px solid rgba(0,180,111,.24)' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 24 },

  card: {
    border: '1px solid rgba(255,255,255,.10)',
    borderRadius: 22,
    padding: 22,
    background: 'rgba(7,18,39,.78)',
    boxShadow: '0 18px 50px rgba(0,0,0,.22)',
  },
};
