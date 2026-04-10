import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';
import { getLiveAccessByEmail } from '@/src/lib/liveAccess';
import { clearLocalSessionToken, validateSingleSession } from '@/src/lib/singleSession';

type ClassVideo = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  kind: 'live' | 'replay';
  starts_at: string | null;
  available_until: string | null;
  is_active: boolean;
};

const plans = [
  { key: 'week', title: '$99 x 1 Semana', envKey: 'NEXT_PUBLIC_STRIPE_PRICE_WEEKLY' },
  { key: 'twoWeeks', title: '$189 x 2 Semanas', envKey: 'NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS' },
  { key: 'fourWeeks', title: '$369 x 4 Semanas', envKey: 'NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS' },
];

function formatDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function formatNextClassDateNY(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  try {
    const datePart = new Intl.DateTimeFormat('es-ES', {
      timeZone: 'America/New_York',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);

    const timePart = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);

    const normalizedDate = datePart.charAt(0).toUpperCase() + datePart.slice(1);
    return `${normalizedDate} - ${timePart} - New York Time`;
  } catch {
    return formatDate(value);
  }
}

function isEmbedUrl(url: string) {
  return /(youtube\.com\/embed|player\.vimeo\.com|youtube-nocookie\.com|loom\.com\/embed)/i.test(url);
}

function getDisplayName(user: any) {
  const metadata = user?.user_metadata || {};
  const rawName =
    metadata.full_name ||
    metadata.name ||
    metadata.first_name ||
    metadata.display_name ||
    '';

  const cleaned = String(rawName).trim();
  if (cleaned) {
    const firstName = cleaned.split(' ')[0]?.trim();
    return firstName || cleaned;
  }

  const email = String(user?.email || '').trim();
  if (!email) return 'Estudiante';

  const localPart = email.split('@')[0] || '';
  const normalized = localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return 'Estudiante';

  const firstWord = normalized.split(' ')[0] || normalized;
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

function formatNYTime() {
  try {
    return new Intl.DateTimeFormat('es-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());
  } catch {
    return '';
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [accessActive, setAccessActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<ClassVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [nowText, setNowText] = useState('');
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', email: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const streamUrl = useMemo(() => (process.env.NEXT_PUBLIC_LIVE_STREAM_EMBED_URL || '').trim(), []);

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) || null,
    [videos, selectedVideoId]
  );

  const nextScheduledClass = useMemo(() => {
    const now = Date.now();
    return (
      videos
        .filter((video) => video.starts_at)
        .filter((video) => {
          const ts = new Date(video.starts_at as string).getTime();
          return !Number.isNaN(ts) && ts > now;
        })
        .sort((a, b) => {
          const aTs = new Date(a.starts_at as string).getTime();
          const bTs = new Date(b.starts_at as string).getTime();
          return aTs - bTs;
        })[0] || null
    );
  }, [videos]);

  async function syncAccessForEmail(email: string) {
    const access = await getLiveAccessByEmail(email);
    setAccessActive(access.active);

    if (access.active) {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from('class_videos')
        .select('id,title,description,video_url,kind,starts_at,available_until,is_active')
        .or(`and(kind.eq.live,is_active.eq.true),and(kind.eq.replay,available_until.gte.${nowIso})`)
        .order('kind', { ascending: true })
        .order('starts_at', { ascending: false });

      const normalizedVideos = ([...(data || [])] as ClassVideo[]);

      if (!normalizedVideos.length && streamUrl) {
        normalizedVideos.push({
          id: 'env-live',
          title: 'Clase en vivo',
          description: 'Streaming configurado desde variable de entorno.',
          video_url: streamUrl,
          kind: 'live',
          starts_at: null,
          available_until: null,
          is_active: true,
        });
      }

      setVideos(normalizedVideos);

      const preferred =
        normalizedVideos.find((video) => video.kind === 'live' && video.is_active) ||
        normalizedVideos[0] ||
        null;

      setSelectedVideoId(preferred?.id || null);
    }

    return access.active;
  }

  useEffect(() => {
    setNowText(formatNYTime());
    const interval = window.setInterval(() => {
      setNowText(formatNYTime());
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadVideos() {
      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from('class_videos')
        .select('id,title,description,video_url,kind,starts_at,available_until,is_active')
        .or(`and(kind.eq.live,is_active.eq.true),and(kind.eq.replay,available_until.gte.${nowIso})`)
        .order('kind', { ascending: true })
        .order('starts_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ClassVideo[];
    }

    async function run() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;

        if (!user) {
          router.replace('/login?next=/dashboard');
          return;
        }

        const isValidSession = await validateSingleSession(user.id);

        if (!isValidSession) {
          await supabase.auth.signOut();
          clearLocalSessionToken();
          router.replace('/login?reason=other_device');
          return;
        }

        const email = user.email || '';
        const access = await getLiveAccessByEmail(email);

        if (!mounted) return;

        const nextDisplayName = getDisplayName(user);

        setUserEmail(email);
        setUserName(nextDisplayName);
        setProfileForm({
          fullName: String(user.user_metadata?.full_name || user.user_metadata?.name || ''),
          phone: String(user.user_metadata?.phone || ''),
          email,
        });
        setAccessActive(access.active);

        if (access.active) {
          const loadedVideos = await loadVideos().catch(() => []);
          if (!mounted) return;

          const normalizedVideos = [...loadedVideos];

          if (!normalizedVideos.length && streamUrl) {
            normalizedVideos.push({
              id: 'env-live',
              title: 'Clase en vivo',
              description: 'Streaming configurado desde variable de entorno.',
              video_url: streamUrl,
              kind: 'live',
              starts_at: null,
              available_until: null,
              is_active: true,
            });
          }

          setVideos(normalizedVideos);

          const preferred =
            normalizedVideos.find((video) => video.kind === 'live' && video.is_active) ||
            normalizedVideos[0] ||
            null;

          setSelectedVideoId(preferred?.id || null);
        }

        setLoading(false);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'No se pudo cargar el portal.');
        setLoading(false);
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, [router, streamUrl]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) return;

      const isValidSession = await validateSingleSession(user.id);

      if (!isValidSession) {
        await supabase.auth.signOut();
        clearLocalSessionToken();
        router.replace('/login?reason=other_device');
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [router]);

  async function updateProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    const fullName = profileForm.fullName.trim();
    const phone = profileForm.phone.trim();
    const nextEmail = profileForm.email.trim().toLowerCase();

    if (!fullName) {
      setSavingProfile(false);
      return setProfileError('Debes ingresar tu nombre completo.');
    }

    if (!nextEmail) {
      setSavingProfile(false);
      return setProfileError('Debes ingresar tu correo electrónico.');
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
      }

      const emailChanged = nextEmail !== userEmail.trim().toLowerCase();
      const { data, error } = await supabase.auth.updateUser({
        email: emailChanged ? nextEmail : undefined,
        data: {
          full_name: fullName,
          phone,
        },
      });

      if (error) throw error;

      if (emailChanged) {
        const syncRes = await fetch('/api/account/sync-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ newEmail: nextEmail }),
        });

        const syncJson = await syncRes.json().catch(() => ({}));
        if (!syncRes.ok) {
          throw new Error(syncJson?.error || 'No se pudo sincronizar el acceso con el nuevo correo.');
        }
      }

      const refreshedUser = data.user;
      const updatedName = getDisplayName(refreshedUser);
      const currentEmail = refreshedUser?.email || userEmail;

      setUserName(updatedName);
      setUserEmail(currentEmail);
      setProfileForm({
        fullName: String(refreshedUser?.user_metadata?.full_name || fullName),
        phone: String(refreshedUser?.user_metadata?.phone || phone),
        email: currentEmail,
      });

      if (!emailChanged) {
        await syncAccessForEmail(nextEmail);
        setProfileSuccess('Tus datos personales fueron actualizados correctamente.');
      } else {
        setProfileSuccess(
          'Solicitud enviada. Revisa tu nuevo correo para confirmar el cambio. Hasta que lo confirmes, seguirás usando tu correo actual.'
        );
      }
    } catch (e: any) {
      const message = String(e?.message || '').toLowerCase();

      if (message.includes('email rate limit exceeded')) {
        setProfileError(
          'Has intentado cambiar el correo varias veces en poco tiempo. Espera unos minutos e inténtalo nuevamente.'
        );
      } else if (message.includes('invalid email')) {
        setProfileError('El correo electrónico no es válido.');
      } else if (message.includes('already registered')) {
        setProfileError('Este correo ya está registrado en el sistema.');
      } else {
        setProfileError('No se pudieron actualizar tus datos personales. Inténtalo nuevamente.');
      }
    } finally {
      setSavingProfile(false);
    }
  }

  async function startCheckout(priceEnvKey: string) {
    try {
      setCheckingOut(priceEnvKey);
      setError(null);

      const res = await fetch('/api/stripe/live-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceKey: priceEnvKey, userEmail }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'No se pudo iniciar el checkout.');
      if (!json?.url) throw new Error('No se recibió la URL del pago.');

      window.location.href = json.url;
    } catch (e: any) {
      setError(e?.message || 'No se pudo iniciar el checkout.');
      setCheckingOut(null);
    }
  }

  async function signOut() {
    clearLocalSessionToken();
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <main className="container dashboard" style={{ maxWidth: '96vw', width: '96vw' }}>
        <div className="panel">Cargando portal...</div>
      </main>
    );
  }

  const hasPlayableVideo = !!selectedVideo?.video_url;
  const showIframe = hasPlayableVideo && isEmbedUrl(selectedVideo.video_url);

  return (
    <main
      className="container dashboard"
      style={{
        maxWidth: '98vw',
        width: '98vw',
        paddingInline: '0.5vw',
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url("/trading-bg.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'saturate(1.05) contrast(1.03)',
          transform: 'scale(1.02)',
          zIndex: 0,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(2,6,23,0.18) 0%, rgba(2,6,23,0.32) 100%)',
          zIndex: 0,
        }}
      />
      <div
        className="dashboard-grid"
        style={{
          gridTemplateColumns: accessActive ? '83.5% 16.5%' : undefined,
          alignItems: 'stretch',
          gap: '20px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <section
          className="panel"
          style={{
            height: '84vh',
            minHeight: '84vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 14,
            background: 'linear-gradient(180deg, rgba(11,29,58,0.28) 0%, rgba(5,18,40,0.28) 100%)',
            boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(148,163,184,0.18)',
          }}
        >
          {accessActive ? (
            <>
              <div
                className="video-shell"
                style={{
                  flex: 1,
                  height: '100%',
                  borderRadius: 24,
                  overflow: 'hidden',
                  display: 'grid',
                  background: '#000',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03), 0 0 0 1px rgba(96,165,250,0.06), 0 20px 40px rgba(0,0,0,0.28)',
                }}
              >
                {showIframe ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <iframe
                      src={
  selectedVideo!.video_url +
  (selectedVideo!.video_url.includes('?') ? '&' : '?') +
  'autoplay=1&controls=0&disablekb=1&playsinline=1&rel=0&modestbranding=1'
}
                      title={selectedVideo?.title || 'Clase'}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none' }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 2,
                      }}
                    />
                  </div>
                ) : hasPlayableVideo ? (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 10 }}>
                        {selectedVideo?.kind === 'replay' ? 'Repetición disponible' : 'Video configurado'}
                      </div>
                      <h2 style={{ marginTop: 0, marginBottom: 10 }}>{selectedVideo?.title}</h2>
                      <p className="helper" style={{ maxWidth: 620, margin: '0 auto 16px' }}>
                        {selectedVideo?.description || 'Este video fue cargado, pero la URL no parece ser un enlace embebible compatible.'}
                      </p>
                      <a
                        href={selectedVideo?.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                      >
                        Abrir video
                      </a>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 10 }}>Próxima clase programada</div>
                      <h2 style={{ marginTop: 0, fontSize: 54, lineHeight: 1.05, marginBottom: 16 }}>
                        {nextScheduledClass ? 'La próxima clase se reproducirá en este portal' : 'Transmisión en VIVO'}
                      </h2>
                      <p className="helper" style={{ maxWidth: 760, fontSize: 20, lineHeight: 1.6, margin: '0 auto 14px' }}>
                        {nextScheduledClass
                          ? formatNextClassDateNY(nextScheduledClass.starts_at)
                          : 'Estamos preparando la próxima transmisión para tu acceso'}
                      </p>
                      {nextScheduledClass?.title ? (
                        <p className="helper" style={{ maxWidth: 620, margin: '0 auto', fontSize: 16, opacity: 0.82 }}>
                          {nextScheduledClass.title}
                        </p>
                      ) : (
                        <p className="helper" style={{ maxWidth: 620, margin: '0 auto', fontSize: 16, opacity: 0.82 }}>
                          Puede seleccionar un video de su biblioteca para reproducir.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="notice">Tu usuario ya está listo. Activa una suscripción para entrar a la clase en vivo.</div>
              <div className="cards" style={{ marginBottom: 0 }}>
                {plans.map((plan) => (
                  <div className="card" key={plan.key}>
                    <h3>{plan.title}</h3>
                    <p className="small">Pago por suscripción con Stripe.</p>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      onClick={() => startCheckout(plan.envKey)}
                      disabled={checkingOut === plan.envKey}
                    >
                      {checkingOut === plan.envKey ? 'Abriendo pago...' : 'Entrar a la clase en vivo'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && <p className="error">{error}</p>}
        </section>

        <aside
          className="panel"
          style={{
            height: '84vh',
            minHeight: '84vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 18,
            background: 'linear-gradient(180deg, rgba(9,25,54,0.22) 0%, rgba(4,15,35,0.22) 100%)',
            boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(96,165,250,0.10)',
          }}
        >
          {accessActive ? (
            <>
              <div
                style={{
                  height: 4,
                  width: 74,
                  borderRadius: 999,
                  marginBottom: 14,
                  background: 'linear-gradient(90deg, #22c55e 0%, #f59e0b 50%, #3b82f6 100%)',
                  boxShadow: '0 0 18px rgba(59,130,246,0.22)',
                }}
              />
              <div className="eyebrow">Biblioteca</div>
              <h2 style={{ marginTop: 12, marginBottom: 18 }}>Clases disponibles</h2>

              <div style={{ display: 'grid', gap: 10, marginBottom: 12, flex: 1, alignContent: 'start' }}>
                {videos.length ? (
                  videos.map((video) => {
                    const selected = selectedVideoId === video.id;
                    return (
                      <button
                        key={video.id}
                        onClick={() => setSelectedVideoId(video.id)}
                        style={{
                          textAlign: 'left',
                          padding: '14px 16px',
                          borderRadius: 16,
                          border: selected ? '1px solid rgba(245, 158, 11, 0.72)' : '1px solid rgba(255,255,255,0.08)',
                          background: selected ? 'linear-gradient(180deg, rgba(245,158,11,0.14) 0%, rgba(30,41,59,0.72) 100%)' : 'rgba(255,255,255,0.03)',
                          color: 'white',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 }}>
                          {video.kind === 'live' ? 'Clase en vivo' : 'Repetición 7 días'}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{video.title}</div>
                        {video.starts_at ? (
                          <div style={{ fontSize: 14, opacity: 0.8 }}>{formatDate(video.starts_at)}</div>
                        ) : null}
                        {video.kind === 'replay' && video.available_until ? (
                          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
                            Disponible hasta {formatDate(video.available_until)}
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <div className="support-item">Aún no hay clases cargadas.</div>
                )}
              </div>

              <div
                style={{
                  padding: '14px 14px 12px',
                  borderRadius: 16,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: isEditingProfile ? 8 : 0,
                  }}
                >
                  <div className="eyebrow" style={{ marginBottom: 0 }}>Mi perfil</div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                    onClick={() => {
                      setIsEditingProfile((prev) => !prev);
                      setProfileError(null);
                      setProfileSuccess(null);
                    }}
                  >
                    {isEditingProfile ? 'Ocultar perfil' : 'Modificar perfil'}
                  </button>
                </div>

                {isEditingProfile ? (
                  <form onSubmit={updateProfile}>
                    <label className="label" style={{ marginBottom: 10, fontSize: 13 }}>
                      Nombre completo
                      <input
                        className="input"
                        value={profileForm.fullName}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))}
                        autoComplete="name"
                        required
                      />
                    </label>

                    <label className="label" style={{ marginBottom: 10, fontSize: 13 }}>
                      Número telefónico
                      <input
                        className="input"
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                        autoComplete="tel"
                      />
                    </label>

                    <label className="label" style={{ marginBottom: 10, fontSize: 13 }}>
                      Correo electrónico
                      <input
                        className="input"
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                        autoComplete="email"
                        required
                      />
                    </label>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-primary" type="submit" disabled={savingProfile} style={{ width: '100%' }}>
                        {savingProfile ? 'Guardando...' : 'Guardar datos'}
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={savingProfile}
                        style={{ width: '100%' }}
                        onClick={() => {
                          setIsEditingProfile(false);
                          setProfileError(null);
                          setProfileSuccess(null);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>

                    <p className="helper" style={{ marginTop: 10, marginBottom: 0, fontSize: 12, lineHeight: 1.45 }}>
                      Si cambias tu correo, el sistema te pedirá confirmarlo por email antes de usarlo como acceso principal.
                    </p>

                    {profileError && <p className="error" style={{ marginTop: 10, marginBottom: 0 }}>{profileError}</p>}
                    {profileSuccess && <p className="success" style={{ marginTop: 10, marginBottom: 0 }}>{profileSuccess}</p>}
                  </form>
                ) : (
                  <p className="helper" style={{ marginTop: 10, marginBottom: 0, fontSize: 12, lineHeight: 1.45 }}>
                    Aquí puedes corregir tu nombre, teléfono o correo electrónico cuando lo necesites.
                  </p>
                )}
              </div>

              <div
                style={{
                  marginTop: 'auto',
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.025) 100%)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 12,
                  lineHeight: 1.45,
                  opacity: 0.88,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Soporte</div>
                <div>Leadacademyve@gmail.com</div>
                <div>+1 786 557 1816</div>
              </div>

              <div
                className="state-pill state-active"
                style={{ alignSelf: 'flex-end', marginTop: 12 }}
              >
                Suscripción activa
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => router.push('/')}>
                  Inicio
                </button>
                <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={signOut}>
                  Salir
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="eyebrow">Soporte</div>
              <h2 style={{ marginTop: 12 }}>Clases en Vivo</h2>
              <div className="support-list">
                <div className="support-item"><strong>Email:</strong><br />Leadacademyve@gmail.com</div>
                <div className="support-item"><strong>WhatsApp:</strong><br />+1 786 557 1816</div>
                <div className="support-item"><strong>Acceso:</strong><br />Tu suscripción activa desbloquea la clase en vivo y repeticiones recientes.</div>
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
