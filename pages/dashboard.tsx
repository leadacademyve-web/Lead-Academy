import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';
import { getLiveAccessByEmail } from '@/src/lib/liveAccess';
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY_CODE, findCountryByCode } from '@/src/lib/countries';
import { clearLocalSessionToken, validateSingleSession } from '@/src/lib/singleSession';

type ClassVideo = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  published_at: string | null;
  is_live: boolean;
  is_published: boolean;
};

const plans = [
  {
    key: 'week',
    title: '$99 x 5 clases',
    subscriptionPriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_WEEKLY',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_WEEKLY_ONE_TIME',
  },
  {
    key: 'twoWeeks',
    title: '$189 x 10 clases',
    subscriptionPriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS_ONE_TIME',
  },
  {
    key: 'fourWeeks',
    title: '$369 x 20 clases',
    subscriptionPriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS_ONE_TIME',
  },
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

function formatReplayTitle(publishedAt?: string | null, fallbackTitle?: string | null) {
  const custom = String(fallbackTitle || '').trim();
  if (custom) return custom;
  if (!publishedAt) return 'Clase grabada';

  const d = new Date(publishedAt);
  if (Number.isNaN(d.getTime())) return 'Clase grabada';

  try {
    const parts = new Intl.DateTimeFormat('es-ES', {
      timeZone: 'America/New_York',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(d);

    const day = parts.find((part) => part.type === 'day')?.value || '';
    const month = parts.find((part) => part.type === 'month')?.value || '';
    const year = parts.find((part) => part.type === 'year')?.value || '';

    if (day && month && year) {
      return `Clase del dia ${day} de ${month} de ${year}`;
    }
  } catch {
    // ignore Intl formatting errors
  }

  return `Clase del dia ${d.getDate()} de ${d.getMonth() + 1} de ${d.getFullYear()}`;
}

function labelForVideo(video: ClassVideo) {
  return video.is_live ? 'Clase en vivo' : formatReplayTitle(video.published_at, video.title);
}

function sublabelForVideo(video: ClassVideo) {
  return video.is_live ? 'Clase en vivo' : 'Clase grabada';
}

function buildLiveVideo(streamUrl: string): ClassVideo | null {
  if (!streamUrl) return null;

  return {
    id: 'env-live',
    title: 'Clase en vivo',
    description: 'Streaming configurado desde variable de entorno.',
    video_url: streamUrl,
    published_at: null,
    is_live: true,
    is_published: true,
  };
}

function normalizeLibraryVideos(rows: Partial<ClassVideo>[], streamUrl: string) {
  const liveFromDb = rows.find((video) => video.is_live && video.video_url);
  const replayRows = rows
    .filter((video) => !video.is_live && video.video_url)
    .sort((a, b) => {
      const aTs = new Date(String(a.published_at || '')).getTime();
      const bTs = new Date(String(b.published_at || '')).getTime();
      return bTs - aTs;
    })
    .slice(0, 5)
    .map((video) => ({
      id: String(video.id || ''),
      title: formatReplayTitle(String(video.published_at || ''), String(video.title || '')),
      description: video.description ? String(video.description) : null,
      video_url: String(video.video_url || ''),
      published_at: video.published_at ? String(video.published_at) : null,
      is_live: false,
      is_published: true,
    } as ClassVideo));

  const liveVideo = liveFromDb
    ? ({
        id: String(liveFromDb.id || 'db-live'),
        title: 'Clase en vivo',
        description: liveFromDb.description ? String(liveFromDb.description) : null,
        video_url: String(liveFromDb.video_url || ''),
        published_at: liveFromDb.published_at ? String(liveFromDb.published_at) : null,
        is_live: true,
        is_published: true,
      } as ClassVideo)
    : buildLiveVideo(streamUrl);

  return liveVideo ? [liveVideo, ...replayRows] : replayRows;
}

function isEmbedUrl(url: string) {
  return /(player\.vimeo\.com|vimeo\.com\/event|loom\.com\/embed)/i.test(url);
}

function splitPhone(fullPhone?: string | null) {
  const raw = String(fullPhone || '').replace(/\s+/g, '').trim();
  if (!raw) return { code: DEFAULT_COUNTRY_CODE, number: '' };

  const match = COUNTRY_OPTIONS
    .slice()
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => raw.startsWith(item.code));

  if (match) {
    return {
      code: match.code,
      number: raw.slice(match.code.length).replace(/\D/g, ''),
    };
  }

  return {
    code: DEFAULT_COUNTRY_CODE,
    number: raw.replace(/\D/g, ''),
  };
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


function totalClassesForPlan(plan?: string | null) {
  switch (String(plan || '').toUpperCase()) {
    case 'WEEKLY':
      return 5;
    case 'TWO_WEEKS':
      return 10;
    case 'FOUR_WEEKS':
      return 20;
    default:
      return null;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [accessActive, setAccessActive] = useState(false);
  const [accessPlan, setAccessPlan] = useState<string | null>(null);
  const [classesRemaining, setClassesRemaining] = useState<number | null>(null);
  const [accessStartAt, setAccessStartAt] = useState<string | null>(null);
  const [lastClassWarning, setLastClassWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<ClassVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [nowText, setNowText] = useState('');
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', email: '' });
  const [selectedCountryCode, setSelectedCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoShellRef = useRef<HTMLDivElement | null>(null);
  const hasTriggeredPortalRecoveryRef = useRef(false);

const streamUrl = useMemo(() => 'https://vimeo.com/event/5863546/embed', []);

  const goThroughPortalRecovery = useCallback(() => {
    if (hasTriggeredPortalRecoveryRef.current) return;
    hasTriggeredPortalRecoveryRef.current = true;

    try {
      sessionStorage.setItem('lead_portal_recovery', '1');
    } catch {
      // ignore storage errors
    }

    router.replace('/?portalRecovery=1');
  }, [router]);


  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) || null,
    [videos, selectedVideoId]
  );

  const visibleLibraryVideos = useMemo(() => {
    if (!isEditingProfile) return videos;
    const liveOnly = videos.filter((video) => video.is_live);
    return liveOnly.length ? liveOnly : videos.slice(0, 1);
  }, [isEditingProfile, videos]);

  const nextScheduledClass = useMemo(() => {
    const now = Date.now();
    return (
      videos
        .filter((video) => video.is_live && video.published_at)
        .filter((video) => {
          const ts = new Date(video.published_at as string).getTime();
          return !Number.isNaN(ts) && ts > now;
        })
        .sort((a, b) => {
          const aTs = new Date(a.published_at as string).getTime();
          const bTs = new Date(b.published_at as string).getTime();
          return aTs - bTs;
        })[0] || null
    );
  }, [videos]);

  async function loadLibraryVideos(accessStartValue: string | null) {
    const query = supabase
      .from('class_videos')
      .select('id,title,description,video_url,published_at,is_live,is_published')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (accessStartValue) {
      query.or(`is_live.eq.true,and(is_live.eq.false,published_at.gte.${accessStartValue})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return normalizeLibraryVideos((data || []) as Partial<ClassVideo>[], streamUrl);
  }

  async function syncAccessForEmail(email: string) {
    const access = await getLiveAccessByEmail(email);
    setAccessActive(access.active);
    setAccessPlan(access.plan ?? null);
    setClassesRemaining(access.classesRemaining ?? null);
    setAccessStartAt(access.accessStartAt ?? null);
    setLastClassWarning(Boolean(access.lastClassWarning));

    if (access.active) {
      const normalizedVideos = await loadLibraryVideos(access.accessStartAt ?? null).catch(() => {
        const liveOnly = buildLiveVideo(streamUrl);
        return liveOnly ? [liveOnly] : [];
      });

      setVideos(normalizedVideos);

      const preferred = normalizedVideos.find((video) => video.is_live) || normalizedVideos[0] || null;
      setSelectedVideoId(preferred?.id || null);
    } else {
      setVideos([]);
      setSelectedVideoId(null);
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
        const initialPhone = String(user.user_metadata?.phone || '');
        const initialSplitPhone = splitPhone(initialPhone);

        setProfileForm({
          fullName: String(user.user_metadata?.full_name || user.user_metadata?.name || ''),
          phone: initialPhone,
          email,
        });
        setSelectedCountryCode(initialSplitPhone.code);
        setPhoneLocal(initialSplitPhone.number);
        setAccessActive(access.active);
        setAccessPlan(access.plan ?? null);
        setClassesRemaining(access.classesRemaining ?? null);
        setAccessStartAt(access.accessStartAt ?? null);
        setLastClassWarning(Boolean(access.lastClassWarning));

        if (access.active) {
          const normalizedVideos = await loadLibraryVideos(access.accessStartAt ?? null).catch(() => {
            const liveOnly = buildLiveVideo(streamUrl);
            return liveOnly ? [liveOnly] : [];
          });
          if (!mounted) return;

          setVideos(normalizedVideos);

          const preferred = normalizedVideos.find((video) => video.is_live) || normalizedVideos[0] || null;
          setSelectedVideoId(preferred?.id || null);
        }

        try {
          sessionStorage.removeItem('lead_portal_recovery');
        } catch {
          // ignore storage errors
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
    setVideoUnavailable(false);
  }, [selectedVideoId]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === videoShellRef.current);
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    try {
      const shouldRecover = sessionStorage.getItem('lead_portal_recovery') === '1';
      if (shouldRecover) {
        goThroughPortalRecovery();
        return;
      }
    } catch {
      // ignore storage errors
    }

    function markRefreshRecovery() {
      try {
        sessionStorage.setItem('lead_portal_recovery', '1');
      } catch {
        // ignore storage errors
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        try {
          sessionStorage.setItem('lead_portal_recovery', '1');
        } catch {
          // ignore storage errors
        }
        return;
      }

      if (document.visibilityState === 'visible') {
        goThroughPortalRecovery();
      }
    }

    window.addEventListener('beforeunload', markRefreshRecovery);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', markRefreshRecovery);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [goThroughPortalRecovery]);

  async function toggleFullscreen() {

    const element = videoShellRef.current;
    if (!element) return;

    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch {
      // ignore fullscreen errors
    }
  }

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
    const digitsOnlyPhone = phoneLocal.replace(/\D/g, '');
    const phone = `${selectedCountryCode}${digitsOnlyPhone}`;
    const nextEmail = profileForm.email.trim().toLowerCase();

    if (!fullName) {
      setSavingProfile(false);
      return setProfileError('Debes ingresar tu nombre completo.');
    }

    if (!digitsOnlyPhone) {
      setSavingProfile(false);
      return setProfileError('Debes ingresar tu número telefónico.');
    }

    if (digitsOnlyPhone.length < 7 || digitsOnlyPhone.length > 15) {
      setSavingProfile(false);
      return setProfileError('Ingresa un número telefónico válido para el país seleccionado.');
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
      const refreshedPhone = String(refreshedUser?.user_metadata?.phone || phone);
      const refreshedSplitPhone = splitPhone(refreshedPhone);

      setProfileForm({
        fullName: String(refreshedUser?.user_metadata?.full_name || fullName),
        phone: refreshedPhone,
        email: currentEmail,
      });
      setSelectedCountryCode(refreshedSplitPhone.code);
      setPhoneLocal(refreshedSplitPhone.number);

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

  async function startCheckout(priceEnvKey: string, purchaseType: 'one_time' | 'subscription') {
    const checkoutKey = `${priceEnvKey}:${purchaseType}`;

    try {
      setCheckingOut(checkoutKey);
      setError(null);

      const res = await fetch('/api/stripe/live-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceKey: priceEnvKey, userEmail, purchaseType }),
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

  const hasPlayableVideo = !!selectedVideo?.video_url && !videoUnavailable;
  const showIframe = hasPlayableVideo && isEmbedUrl(selectedVideo.video_url);
  const totalClassesForCurrentPlan = totalClassesForPlan(accessPlan);
  const classesUsed =
    totalClassesForCurrentPlan !== null && classesRemaining !== null
      ? Math.max(totalClassesForCurrentPlan - classesRemaining, 0)
      : null;

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
            height: '88vh',
            minHeight: '88vh',
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
                ref={videoShellRef}
                className="video-shell"
                style={{
                  flex: 1,
                  height: '100%',
                  borderRadius: 24,
                  overflow: 'hidden',
                  display: 'block',
                  background: '#000',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03), 0 0 0 1px rgba(96,165,250,0.06), 0 20px 40px rgba(0,0,0,0.28)',
                }}
              >
                {showIframe ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
                    <iframe
                      src={`${selectedVideo!.video_url}${selectedVideo!.video_url.includes('?') ? '&' : '?'}quality=1080p&autoplay=1&muted=0&playsinline=1&title=0&byline=0&portrait=0&dnt=1`}
                      title={selectedVideo?.title || 'Clase'}
                      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share"
                      allowFullScreen
                      onError={() => setVideoUnavailable(true)}
                      style={{ width: '100%', height: '100%', border: 0, display: 'block', pointerEvents: 'none' }}
                    />

                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 2,
                        background: 'transparent',
                        pointerEvents: 'none',
                      }}
                    />

                    <button
                      type="button"
                      aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Entrar a pantalla completa'}
                      title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                      onClick={toggleFullscreen}
                      style={{
                        position: 'absolute',
                        right: 14,
                        bottom: 14,
                        zIndex: 3,
                        width: 34,
                        height: 34,
                        minWidth: 34,
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.16)',
                        background: 'rgba(15,23,42,0.72)',
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        lineHeight: 1,
                        boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
                        backdropFilter: 'blur(8px)',
                        cursor: 'pointer',
                      }}
                    >
                      {isFullscreen ? '⤡' : '⤢'}
                    </button>
                  </div>
                ) : hasPlayableVideo ? (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 10 }}>
                        {selectedVideo?.is_live ? 'Clase en vivo' : 'Clase grabada'}
                      </div>
                      <h2 style={{ marginTop: 0, marginBottom: 10 }}>{selectedVideo ? labelForVideo(selectedVideo) : ''}</h2>
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
                  <div style={{ position: 'relative', display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 10 }}>
                        {videoUnavailable ? 'Transmisión temporalmente no disponible' : 'Próxima clase programada'}
                      </div>
                      <h2 style={{ marginTop: 0, fontSize: 54, lineHeight: 1.05, marginBottom: 16 }}>
                        {videoUnavailable
                          ? 'Transmisión en VIVO'
                          : nextScheduledClass
                            ? 'La próxima clase se reproducirá en este portal'
                            : 'Transmisión en VIVO'}
                      </h2>
                      <p className="helper" style={{ maxWidth: 760, fontSize: 20, lineHeight: 1.6, margin: '0 auto 14px' }}>
                        {videoUnavailable
                          ? 'Estamos preparando la próxima transmisión para tu acceso.'
                          : nextScheduledClass
                            ? formatNextClassDateNY(nextScheduledClass.published_at)
                            : 'Estamos preparando la próxima transmisión para tu acceso'}
                      </p>
                      {videoUnavailable ? (
                        <p className="helper" style={{ maxWidth: 620, margin: '0 auto', fontSize: 16, opacity: 0.82 }}>
                          El video actual no está disponible en este momento. Puedes volver a intentarlo más tarde.
                        </p>
                      ) : nextScheduledClass?.title ? (
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
                {plans.map((plan) => {
                  return (
                    <div className="card" key={plan.key}>
                      <h3>{plan.title}</h3>
                      <p className="small" style={{ marginBottom: 12 }}>
                        Elige cómo quieres pagar este acceso al portal.
                      </p>

                      <div style={{ display: 'grid', gap: 10 }}>
                        <button
                          className="btn btn-primary"
                          style={{ width: '100%' }}
                          onClick={() =>
                            router.push(
                              `/checkout-confirm?subscriptionPriceKey=${encodeURIComponent(plan.subscriptionPriceKey)}&oneTimePriceKey=${encodeURIComponent(plan.oneTimePriceKey)}&title=${encodeURIComponent(plan.title)}`
                            )
                          }
                          disabled={checkingOut !== null}
                        >
                          Comprar este plan
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {error && <p className="error">{error}</p>}
        </section>

        <aside
          className="panel"
          style={{
            height: '88vh',
            minHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
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
                {visibleLibraryVideos.length ? (
                  visibleLibraryVideos.map((video) => {
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
                          {sublabelForVideo(video)}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 18 }}>{labelForVideo(video)}</div>
                      </button>
                    );
                  })
                ) : (
                  <div className="support-item">Aún no hay clases cargadas.</div>
                )}
              </div>

              {isEditingProfile ? (
                <p className="helper" style={{ marginTop: 0, marginBottom: 12, fontSize: 12, lineHeight: 1.45 }}>
                  Edita tu perfil y presiona "Guardar datos".
                </p>
              ) : null}

              {lastClassWarning ? (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 16,
                    background: 'linear-gradient(180deg, rgba(245,158,11,0.16) 0%, rgba(120,53,15,0.18) 100%)',
                    border: '1px solid rgba(245,158,11,0.40)',
                    marginBottom: 12,
                    boxShadow: '0 12px 28px rgba(0,0,0,0.16)',
                  }}
                >
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Aviso de suscripción</div>
                  <div style={{ fontSize: 15, lineHeight: 1.5, color: 'rgba(255,255,255,0.92)' }}>
                    Estás entrando en tu última clase disponible. Para seguir accediendo al portal deberás renovar tu suscripción.
                  </div>
                </div>
              ) : null}

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
                      <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 10 }}>
                        <select
                          className="input"
                          value={selectedCountryCode}
                          onChange={(e) => setSelectedCountryCode(e.target.value)}
                          aria-label="Código de país"
                        >
                          {COUNTRY_OPTIONS.map((option) => (
                            <option key={`${option.code}-${option.label}`} value={option.code}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <input
                          className="input"
                          type="tel"
                          value={phoneLocal}
                          onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d]/g, ''))}
                          autoComplete="tel-national"
                          inputMode="numeric"
                          placeholder={findCountryByCode(selectedCountryCode).placeholder}
                        />
                      </div>
                      <p className="helper" style={{ marginTop: 8, marginBottom: 0 }}>
                        Se guardará en formato internacional, por ejemplo: {selectedCountryCode}{findCountryByCode(selectedCountryCode).placeholder}
                      </p>
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
                      Si cambias tu correo, el sistema te pedirá confirmarlo por email antes de usarlo como acceso principal. No cambies mas de dos veces el mismo día y evita bloquear tu cuenta por seguridad.
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
                {classesRemaining !== null
                  ? `Suscripción activa: ${classesRemaining} clases restantes`
                  : 'Suscripción activa'}
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
