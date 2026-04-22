import { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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

type ChatMessage = {
  id: string;
  user_email: string | null;
  user_name: string | null;
  body: string;
  image_url: string | null;
  created_at: string | null;
};

type LibraryItem = {
  id: string;
  title: string;
  kind: 'download' | 'image' | 'video';
  url: string;
  description: string;
};

const plans = [
  {
    key: 'week',
    title: '$99 x 5 clases',
    description: 'Elige cómo quieres pagar este acceso al portal.',
    buttonLabel: 'Comprar este plan',
    subscriptionPriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_WEEKLY',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_WEEKLY_ONE_TIME',
  },
  {
    key: 'twoWeeks',
    title: '$189 x 10 clases',
    description: 'Elige cómo quieres pagar este acceso al portal.',
    buttonLabel: 'Comprar este plan',
    subscriptionPriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS_ONE_TIME',
  },
  {
    key: 'fourWeeks',
    title: '$369 x 20 clases',
    description: 'Elige cómo quieres pagar este acceso al portal.',
    buttonLabel: 'Comprar este plan',
    subscriptionPriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS_ONE_TIME',
  },
  {
    key: 'intensiveApril2026',
    title: '$500 x 5 clases',
    description: 'Curso intensivo del 18 al 19 de abril 2026',
    buttonLabel: 'Inscribirme',
    subscriptionPriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_INTENSIVE_ONE_TIME',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_INTENSIVE_ONE_TIME',
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
  if (video.is_live) return 'Clase en vivo';
  if (String(video.id).startsWith('library-video-')) return 'Video';
  return 'Clase grabada';
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

function formatChatMessageTime(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  try {
    return new Intl.DateTimeFormat('es-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      month: 'numeric',
      day: 'numeric',
    }).format(d);
  } catch {
    return '';
  }
}



function isImageFile(file: File) {
  return file.type.startsWith('image/');
}

function sanitizeChatImage(file: File) {
  if (!isImageFile(file)) {
    throw new Error('Solo se permiten imágenes.');
  }

  const maxBytes = 8 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('La imagen supera el límite de 8 MB.');
  }

  return file;
}

async function uploadChatImage(file: File) {
  const safeFile = sanitizeChatImage(file);
  const extensionFromName = safeFile.name.split('.').pop()?.trim().toLowerCase();
  const extensionFromType = safeFile.type.split('/')[1]?.trim().toLowerCase();
  const extension = extensionFromName || extensionFromType || 'png';
  const fileName = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('Chat-Images')
    .upload(fileName, safeFile, {
      cacheControl: '3600',
      upsert: false,
      contentType: safeFile.type || 'image/png',
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from('Chat-Images').getPublicUrl(fileName);
  return data.publicUrl;
}


const EMOJI_CATEGORIES = [
  {
    label: 'Trading',
    emojis: ['📈', '📉', '💰', '💵', '💸', '🚀', '🔥', '📊', '🐂', '🐻', '🏦', '💹', '🪙', '📌', '✅', '⚠️'],
  },
  {
    label: 'Reacciones',
    emojis: ['😀', '😄', '😁', '😎', '🤩', '👏', '🙌', '👍', '👊', '🙏', '🔥', '💯', '✨', '🎯', '💪', '❤️'],
  },
  {
    label: 'Ideas',
    emojis: ['🧠', '🤔', '😮', '😯', '😅', '😂', '😬', '😴', '😤', '🤯', '📝', '📚', '⏰', '👀', '🎉', '📣'],
  },
];
const LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: 'plan-inversiones-excel',
    title: 'Plan de inversiones en Excel',
    kind: 'download',
    url: '/Plan de inversiones en Excel.xlsx',
    description: 'Descargar archivo',
  },
{
  id: 'tc2000-layout hora',
  title: 'TC2000 Marco tiempo Hora',
  kind: 'download',
  url: 'https://www.tc2000.com/~u16xJ9',
  description: 'Abrir en TC2000',
},
  {
  id: 'tc2000-layout 15 min',
  title: 'TC2000 Marco tiempo Hora / 15 min',
  kind: 'download',
  url: 'https://www.tc2000.com/~Zx7zTO',
  description: 'Abrir en TC2000',
},
  {
    id: 'video-configuracion-tc2000',
    title: 'Configuración TC2000',
    kind: 'video',
    url: 'https://player.vimeo.com/video/1185325573',
    description: 'Reproducir video',
  },
  {
  id: 'video-compra-venta-thinkorswim',
  title: 'Compra y venta en Thinkorswim',
  kind: 'video',
  url: 'https://player.vimeo.com/video/1185354264',
  description: 'Reproducir video',
},
  {
    id: 'est-apertura-bajista',
    title: 'Est. Apertura bajista',
    kind: 'image',
    url: '/Est. Apertura bajista.jpg',
    description: 'Imagen de estrategia',
  },
  {
    id: 'est-apertura-alcista',
    title: 'Est. Apertura alcista',
    kind: 'image',
    url: '/Est. Apertura alcista.jpg',
    description: 'Imagen de estrategia',
  },
  {
    id: 'est-ruptura-bajista',
    title: 'Est. Ruptura bajista',
    kind: 'image',
    url: '/Est. Ruptura bajista.jpg',
    description: 'Imagen de estrategia',
  },
  {
    id: 'est-ruptura-alcista',
    title: 'Est. Ruptura alcista',
    kind: 'image',
    url: '/Est. Ruptura alcista.jpg',
    description: 'Imagen de estrategia',
  },
];



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


function normalizeEmailList(raw: string) {
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isChatAdminEmail(email?: string | null) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;

  const envEmails = normalizeEmailList(process.env.NEXT_PUBLIC_CHAT_ADMIN_EMAILS || '');
  const fallbackEmails = ['leadacademyve@gmail.com'];
  return [...envEmails, ...fallbackEmails].includes(normalized);
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
  const [selectedLibraryItemId, setSelectedLibraryItemId] = useState<string | null>(null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [activeImageTitle, setActiveImageTitle] = useState<string | null>(null);
  const [activeLibraryVideo, setActiveLibraryVideo] = useState<LibraryItem | null>(null);
  const [nowText, setNowText] = useState('');
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', email: '' });
  const [selectedCountryCode, setSelectedCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'chatLive' | 'biblioteca'>('videos');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [clearingChat, setClearingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [chatImageFile, setChatImageFile] = useState<File | null>(null);
  const [chatImagePreviewUrl, setChatImagePreviewUrl] = useState<string | null>(null);
  const [isDragOverChat, setIsDragOverChat] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const emojiPanelRef = useRef<HTMLDivElement | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);

const streamUrl = useMemo(() => 'https://vimeo.com/event/5863546/embed', []);

  const isChatAdmin = useMemo(() => isChatAdminEmail(userEmail), [userEmail]);

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) || null,
    [videos, selectedVideoId]
  );


  const selectedLibraryItem = useMemo(
    () => LIBRARY_ITEMS.find((item) => item.id === selectedLibraryItemId) || null,
    [selectedLibraryItemId]
  );

function openLibraryItem(item: LibraryItem) {
  if (selectedLibraryItemId === item.id) {
    setSelectedLibraryItemId(null);
    setActiveLibraryVideo(null);
    setActiveImageUrl(null);
    setActiveImageTitle(null);
    return;
  }

  setSelectedLibraryItemId(item.id);

  if (item.kind === 'download') {
    setActiveLibraryVideo(null);
    setActiveImageUrl(null);
    setActiveImageTitle(null);

    if (item.url.startsWith('http')) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (typeof window !== 'undefined') {
      const link = document.createElement('a');
      link.href = item.url;
      link.download = item.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    return;
  }

  if (item.kind === 'video') {
    setActiveImageUrl(null);
    setActiveImageTitle(null);
    setActiveLibraryVideo(item);
    return;
  }

  setActiveLibraryVideo(null);
  setActiveImageUrl(item.url);
  setActiveImageTitle(item.title);
}

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

const normalized = normalizeLibraryVideos((data || []) as Partial<ClassVideo>[], streamUrl);
return normalized;
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
    if (activeTab !== 'biblioteca') return;
    if (!selectedLibraryItemId && LIBRARY_ITEMS.length) {
      setSelectedLibraryItemId(LIBRARY_ITEMS[0].id);
    }
  }, [activeTab, selectedLibraryItemId]);

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



  function clearSelectedChatImage() {
    setChatImageFile(null);
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = '';
    }
  }

  function attachChatImage(file: File) {
    try {
      const safeFile = sanitizeChatImage(file);
      setChatError(null);
      setChatImageFile(safeFile);
    } catch (e: any) {
      setChatError(e?.message || 'No se pudo adjuntar la imagen.');
    }
  }

  function handleChatFileSelection(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    attachChatImage(file);
  }

  function handleChatPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = Array.from(e.clipboardData.items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    e.preventDefault();
    attachChatImage(file);
  }

  function handleChatDragOver(e: DragEvent<HTMLFormElement>) {
    const hasImageFile = Array.from(e.dataTransfer.items || []).some((item) => item.type.startsWith('image/'));
    if (!hasImageFile) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOverChat(true);
  }

  function handleChatDragLeave(e: DragEvent<HTMLFormElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragOverChat(false);
    }
  }

  function handleChatDrop(e: DragEvent<HTMLFormElement>) {
    const imageFile = Array.from(e.dataTransfer.files || []).find((file) => file.type.startsWith('image/'));
    if (!imageFile) return;

    e.preventDefault();
    setIsDragOverChat(false);
    attachChatImage(imageFile);
  }

  async function loadChatMessages() {
    setChatLoading(true);
    setChatError(null);

    const { data, error } = await supabase
      .from('live_chat_messages')
      .select('id,user_email,user_name,body,image_url,created_at')
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      setChatMessages([]);
      setChatError('No se pudo cargar el chat en vivo.');
      setChatLoading(false);
      return;
    }

    setChatMessages((data || []) as ChatMessage[]);
    setChatLoading(false);
  }

  async function sendChatMessage(e: FormEvent) {
    e.preventDefault();

    const body = chatInput.trim();
    if ((!body && !chatImageFile) || sendingChat) return;

    setSendingChat(true);
    setChatError(null);

    try {
      let imageUrl: string | null = null;

      if (chatImageFile) {
        imageUrl = await uploadChatImage(chatImageFile);
      }

      const payload = {
        user_email: userEmail || null,
        user_name: userName || 'Estudiante',
        body,
        image_url: imageUrl,
      };

      const { error } = await supabase.from('live_chat_messages').insert(payload);

      if (error) {
        throw error;
      }

      setChatInput('');
      clearSelectedChatImage();
    } catch (e: any) {
      setChatError(e?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setSendingChat(false);
    }
  }

  async function deleteChatMessage(messageId: string, ownerEmail?: string | null) {
    const owner = String(ownerEmail || '').trim().toLowerCase();
    const current = String(userEmail || '').trim().toLowerCase();
    const canDelete = Boolean(messageId) && (isChatAdmin || (owner && current && owner === current));

    if (!canDelete || deletingMessageId || clearingChat) return;

    setDeletingMessageId(messageId);
    setChatError(null);

    const { error } = await supabase
      .from('live_chat_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      setChatError('No se pudo eliminar el mensaje.');
      setDeletingMessageId(null);
      return;
    }

    setChatMessages((prev) => prev.filter((item) => item.id !== messageId));
    setDeletingMessageId(null);
  }

  async function clearAllChatMessages() {
    if (!isChatAdmin || clearingChat || deletingMessageId || !chatMessages.length) return;

    const confirmed = window.confirm('¿Seguro que deseas borrar todos los mensajes del chat en vivo?');
    if (!confirmed) return;

    setClearingChat(true);
    setChatError(null);

    const { error } = await supabase
      .from('live_chat_messages')
      .delete()
      .not('id', 'is', null);

    if (error) {
      setChatError(`No se pudo borrar todo el chat. ${error.message || ''}`.trim());
      setClearingChat(false);
      return;
    }

    setChatMessages([]);
    setClearingChat(false);
  }


  useEffect(() => {
    if (!accessActive) return;

    loadChatMessages();
  }, [accessActive]);

  useEffect(() => {
    if (!accessActive) return;

    const channel = supabase
      .channel('leadacademy-live-chat')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_chat_messages' },
        () => {
          loadChatMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accessActive]);

  useEffect(() => {
    if (activeTab !== 'chatLive') return;

    const container = chatScrollRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
  }, [activeTab, chatMessages]);

  useEffect(() => {
    if (!showEmojiPanel) return;

    function handlePointerDown(event: MouseEvent) {
      if (!emojiPanelRef.current) return;
      if (emojiPanelRef.current.contains(event.target as Node)) return;
      setShowEmojiPanel(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [showEmojiPanel]);



  useEffect(() => {
    if (!chatImageFile) {
      setChatImagePreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      return;
    }

    const objectUrl = URL.createObjectURL(chatImageFile);
    setChatImagePreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return objectUrl;
    });

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [chatImageFile]);

  function appendEmoji(emoji: string) {    setChatInput((prev) => {
      const nextValue = `${prev}${emoji}`;
      return nextValue.slice(0, 500);
    });
  }

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
            minHeight: '90vh',
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
                  width: '100%',
                  height: '100%',
                  alignSelf: 'stretch',
                  borderRadius: 24,
                  overflow: 'hidden',
                  display: 'block',
                  background: '#000',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03), 0 0 0 1px rgba(96,165,250,0.06), 0 20px 40px rgba(0,0,0,0.28)',
                }}
              >
                {activeTab === 'biblioteca' && activeLibraryVideo ? (
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      border: 0,
                      display: 'block',
                    }}
                  >
                    <iframe
                      src={`${activeLibraryVideo.url}${activeLibraryVideo.url.includes('?') ? '&' : '?'}quality=1080&autoplay=1&muted=0&playsinline=1&title=0&byline=0&portrait=0&dnt=1`}
                      title={activeLibraryVideo.title || 'Video de biblioteca'}
                      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share"
                      allowFullScreen
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 0,
                        display: 'block',
                      }}
                    />
                  </div>
                ) : activeTab === 'biblioteca' && activeImageUrl ? (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'grid',
                      placeItems: 'center',
                      background: '#000',
                      padding: 18,
                    }}
                  >
                    <img
                      src={activeImageUrl}
                      alt={activeImageTitle || 'Imagen de biblioteca'}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                        borderRadius: 18,
                      }}
                    />
                  </div>
                ) : showIframe ? (
                  <div style={{
  position: 'relative',
  top: '50%',
  left: '50%',
  width: '100%',
  height: '100%',
  border: 0,
  display: 'block',
  transform: 'translate(-50%, -50%)',
}}>
                    <iframe
                      src={`${selectedVideo!.video_url}${selectedVideo!.video_url.includes('?') ? '&' : '?'}quality=1080&autoplay=1&muted=0&playsinline=1&title=0&byline=0&portrait=0&dnt=1`}
                      title={selectedVideo?.title || 'Clase'}
                      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; web-share"
                      allowFullScreen
                      onError={() => setVideoUnavailable(true)}
                      style={{
  width: '100%',
  height: '100%',
  border: 0,
  display: 'block',
  objectFit: 'cover'
}}
                    />

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
                        {plan.description}
                      </p>

                      <div style={{ display: 'grid', gap: 10 }}>
                        <button
                          className="btn btn-primary"
                          style={{ width: '100%' }}
                          onClick={() =>
                            router.push(
                              `/checkout-confirm?subscriptionPriceKey=${encodeURIComponent(plan.subscriptionPriceKey)}&oneTimePriceKey=${encodeURIComponent(plan.oneTimePriceKey)}&title=${encodeURIComponent(plan.title)}${plan.key === 'intensiveApril2026' ? `&classesOverride=5&hidePurchaseType=1&levelOverride=${encodeURIComponent('INTENSIVE_TWO_DAY')}` : ''}`
                            )
                          }
                          disabled={checkingOut !== null}
                        >
                          {plan.buttonLabel}
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
                  display: 'flex',
                  gap: 16,
                  marginBottom: 18,
                  alignItems: 'flex-start',
                  flexWrap: 'nowrap',
                }}
              >
                {[
                  { key: 'videos' as const, label: 'Videos' },
                  { key: 'chatLive' as const, label: 'Chat Live' },
                  { key: 'biblioteca' as const, label: 'Biblioteca' },
                ].map((tab) => {
                  const isActive = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        background: 'transparent',
                        border: 0,
                        padding: 0,
                        margin: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'inherit',
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          height: 4,
                          width: '100%',
                          borderRadius: 999,
                          marginBottom: 10,
                          background: 'linear-gradient(90deg, #22c55e 0%, #f59e0b 50%, #3b82f6 100%)',
                          boxShadow: isActive ? '0 0 18px rgba(59,130,246,0.22)' : 'none',
                          opacity: isActive ? 1 : 0.4,
                        }}
                      />
                      <div
                        className="eyebrow"
                        style={{
                          marginBottom: 0,
                          color: isActive ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.58)',
                          transition: 'color 0.2s ease, opacity 0.2s ease',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tab.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {activeTab === 'videos' ? (
                <>
                  <h2 style={{ marginTop: 0, marginBottom: 18 }}>Clases disponibles</h2>

                  <div style={{ display: 'grid', gap: 10, marginBottom: 12, flex: 1, alignContent: 'start' }}>
                    {visibleLibraryVideos.length ? (
                      visibleLibraryVideos.map((video) => {
                        const selected = selectedVideoId === video.id;
                        return (
                          <button
                            key={video.id}
                            onClick={() => {
                              setActiveLibraryVideo(null);
                              setSelectedVideoId(video.id);
                            }}
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
                    <div>+1 786 620 4377</div>
                  </div>
                </>
              ) : activeTab === 'chatLive' ? (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    borderRadius: 18,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.018) 100%)',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 22 }}>Chat Live</h2>
                        <p className="helper" style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.45 }}>
                          Escribe aquí durante la clase. Los mensajes aparecerán en tiempo real y el instructor podrá verlos y/o compartirlos.
                        </p>
                      </div>
                      {isChatAdmin ? (
                        <button
                          type="button"
                          onClick={clearAllChatMessages}
                          disabled={clearingChat || deletingMessageId !== null || !chatMessages.length}
                          className="btn btn-ghost"
                          style={{
                            padding: '8px 12px',
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                            border: '1px solid rgba(239,68,68,0.34)',
                            color: 'rgba(255,255,255,0.92)',
                            background: clearingChat ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.03)',
                          }}
                        >
                          {clearingChat ? 'Borrando chat...' : 'Borrar todo'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div
                    ref={chatScrollRef}
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      padding: '14px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {chatLoading ? (
                      <div className="support-item">Cargando chat...</div>
                    ) : chatMessages.length ? (
                      chatMessages.map((message) => {
                        const isOwnMessage =
                          !!userEmail &&
                          !!message.user_email &&
                          message.user_email.toLowerCase() === userEmail.toLowerCase();

                        return (
                          <div
                            key={message.id}
                            style={{
                              alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                              maxWidth: '92%',
                              padding: '12px 14px',
                              borderRadius: 16,
                              background: isOwnMessage
                                ? 'linear-gradient(180deg, rgba(245,158,11,0.22) 0%, rgba(180,83,9,0.18) 100%)'
                                : 'rgba(255,255,255,0.06)',
                              border: isOwnMessage
                                ? '1px solid rgba(245,158,11,0.42)'
                                : '1px solid rgba(255,255,255,0.07)',
                              boxShadow: '0 10px 24px rgba(0,0,0,0.14)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 10,
                                marginBottom: 6,
                                alignItems: 'flex-start',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  letterSpacing: 0.3,
                                  color: 'rgba(255,255,255,0.92)',
                                }}
                              >
                                {message.user_name || 'Estudiante'}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                <div style={{ fontSize: 11, opacity: 0.58, whiteSpace: 'nowrap' }}>
                                  {formatChatMessageTime(message.created_at)}
                                </div>
                                {isChatAdmin || isOwnMessage ? (
                                  <button
                                    type="button"
                                    onClick={() => deleteChatMessage(message.id, message.user_email)}
                                    disabled={clearingChat || deletingMessageId === message.id}
                                    title={isChatAdmin && !isOwnMessage ? 'Eliminar mensaje de este estudiante' : 'Eliminar mi mensaje'}
                                    aria-label={isChatAdmin && !isOwnMessage ? 'Eliminar mensaje de este estudiante' : 'Eliminar mi mensaje'}
                                    style={{
                                      minWidth: 30,
                                      height: 30,
                                      padding: 0,
                                      display: 'grid',
                                      placeItems: 'center',
                                      borderRadius: 10,
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      background: deletingMessageId === message.id ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)',
                                      color: 'white',
                                      cursor: 'pointer',
                                      fontSize: 14,
                                      lineHeight: 1,
                                    }}
                                  >
                                    {deletingMessageId === message.id ? '…' : '🗑️'}
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {message.body ? (
                              <div style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.96)', whiteSpace: 'pre-wrap' }}>
                                {message.body}
                              </div>
                            ) : null}

                            {message.image_url ? (
                              <img
                                src={message.image_url}
                                alt="Imagen adjunta del chat"
                                style={{
                                  marginTop: message.body ? 10 : 0,
                                  width: '100%',
                                  maxWidth: 260,
                                  maxHeight: 320,
                                  objectFit: 'cover',
                                  display: 'block',
                                  borderRadius: 14,
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  background: 'rgba(255,255,255,0.04)',
                                }}
                              />
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <div className="support-item">Aún no hay mensajes en el chat.</div>
                    )}
                  </div>

                  <form
                    onSubmit={sendChatMessage}
                    onDragOver={handleChatDragOver}
                    onDragLeave={handleChatDragLeave}
                    onDrop={handleChatDrop}
                    style={{
                      padding: 12,
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      display: 'grid',
                      gap: 10,
                      background: isDragOverChat ? 'rgba(59,130,246,0.08)' : 'transparent',
                      outline: isDragOverChat ? '1px dashed rgba(96,165,250,0.5)' : 'none',
                      outlineOffset: -1,
                    }}
                  >

                    <input
                      ref={chatFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleChatFileSelection}
                      style={{ display: 'none' }}
                    />

                    {chatImagePreviewUrl ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: 10,
                          borderRadius: 16,
                          border: '1px solid rgba(255,255,255,0.10)',
                          background: 'rgba(255,255,255,0.04)',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                          <img
                            src={chatImagePreviewUrl}
                            alt="Vista previa"
                            style={{
                              width: 72,
                              height: 72,
                              objectFit: 'cover',
                              borderRadius: 12,
                              border: '1px solid rgba(255,255,255,0.08)',
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Imagen lista para enviar</div>
                            <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.45 }}>
                              Puedes escribir un comentario y enviarlo junto con esta imagen.
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={clearSelectedChatImage}
                          style={{
                            minWidth: 34,
                            height: 34,
                            borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.10)',
                            background: 'rgba(255,255,255,0.04)',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: 16,
                            lineHeight: 1,
                            flexShrink: 0,
                          }}
                          aria-label="Quitar imagen adjunta"
                          title="Quitar imagen"
                        >
                          ✕
                        </button>
                      </div>
                    ) : null}

                    {showEmojiPanel ? (
                      <div
                        ref={emojiPanelRef}
                        style={{
                          width: '100%',
                          maxHeight: 280,
                          overflowY: 'auto',
                          borderRadius: 18,
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: 'linear-gradient(180deg, rgba(10,18,36,0.98) 0%, rgba(5,12,28,0.98) 100%)',
                          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
                          padding: 12,
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, marginBottom: 10 }}>
                          Elige emojis para tu mensaje
                        </div>
                        {EMOJI_CATEGORIES.map((category) => (
                          <div key={category.label} style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', opacity: 0.58, marginBottom: 8 }}>
                              {category.label}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 6 }}>
                              {category.emojis.map((emoji) => (
                                <button
                                  key={`${category.label}-${emoji}`}
                                  type="button"
                                  onClick={() => appendEmoji(emoji)}
                                  style={{
                                    height: 36,
                                    borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'rgba(255,255,255,0.04)',
                                    color: 'white',
                                    fontSize: 20,
                                    lineHeight: 1,
                                    cursor: 'pointer',
                                  }}
                                  aria-label={`Agregar ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onPaste={handleChatPaste}
                      placeholder="Escribe tu mensaje aquí..."
                      rows={3}
                      style={{
                        width: '100%',
                        resize: 'none',
                        borderRadius: 14,
                        border: '1px solid rgba(255,255,255,0.10)',
                        background: 'rgba(2,6,23,0.42)',
                        color: 'white',
                        padding: '12px 14px',
                        outline: 'none',
                        font: 'inherit',
                        lineHeight: 1.45,
                      }}
                      maxLength={500}
                    />


                    <div style={{ fontSize: 11, opacity: 0.62, lineHeight: 1.4 }}>
                      Puedes pegar una captura con <strong>Ctrl+V</strong> o <strong>Cmd+V</strong>, o arrastrar una imagen aquí.
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setShowEmojiPanel((prev) => !prev)}
                          style={{
                            minWidth: 48,
                            height: 40,
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.10)',
                            background: showEmojiPanel ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)',
                            color: 'white',
                            fontSize: 20,
                            cursor: 'pointer',
                          }}
                          aria-label="Abrir panel de emojis"
                          title="Emojis"
                        >
                          😊
                        </button>
                        <button
                          type="button"
                          onClick={() => chatFileInputRef.current?.click()}
                          style={{
                            minWidth: 48,
                            height: 40,
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.10)',
                            background: chatImageFile ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)',
                            color: 'white',
                            fontSize: 18,
                            cursor: 'pointer',
                          }}
                          aria-label="Adjuntar imagen"
                          title="Adjuntar imagen"
                        >
                          📎
                        </button>
                        <div style={{ fontSize: 11, opacity: 0.58 }}>
                          {chatInput.trim().length}/500{chatImageFile ? ' • imagen lista' : ''}
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={(!chatInput.trim() && !chatImageFile) || sendingChat}
                        style={{ minWidth: 140 }}
                      >
                        {sendingChat ? 'Enviando...' : 'Enviar mensaje'}
                      </button>
                    </div>

                    {chatError ? <p className="error" style={{ margin: 0 }}>{chatError}</p> : null}
                  </form>
                </div>
              ) : (
                <>
                  <h2 style={{ marginTop: 0, marginBottom: 18 }}>Biblioteca</h2>

                  <div style={{ display: 'grid', gap: 10, marginBottom: 12, flex: 1, alignContent: 'start' }}>
                    {LIBRARY_ITEMS.map((item) => {
                      const selected = selectedLibraryItemId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => openLibraryItem(item)}
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
                            {item.kind === 'download'
  ? (item.url.startsWith('http') ? 'Link' : 'Descarga')
  : item.kind === 'video'
    ? 'Video'
    : 'Biblioteca'}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 18 }}>{item.title}</div>
                        </button>
                      );
                    })}
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
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Contenido</div>
                    <div>
                      {selectedLibraryItem?.kind === 'download'
                        ? selectedLibraryItem?.url?.startsWith('http')
                          ? 'Este botón abrirá un link externo.'
                          : 'Este botón descargará el archivo.'
                        : selectedLibraryItem?.kind === 'video'
                          ? 'Este botón reproducirá un video en la pantalla principal.'
                          : selectedLibraryItem?.title
                            ? `Mostrando: ${selectedLibraryItem.title}`
                            : 'Selecciona un elemento de la biblioteca.'}
                    </div>
                  </div>
                </>
              )}

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
                <div className="support-item"><strong>Acceso:</strong><br />Tener una suscripcion activa o inscribirte en el curso te dara acceso al portal.</div>
                <div className="support-item"><strong>Email de soporte:</strong><br />Leadacademyve@gmail.com</div>
                <div className="support-item"><strong>WhatsApp:</strong><br />+1 786 620 4377</div>
              
              </div>

              <div style={{ marginTop: 18, textAlign: 'center' }}>
                <button
                  className="btn btn-primary"
                  style={{
                    minWidth: 220,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    boxShadow: '0 0 18px rgba(245,158,11,0.35)',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => router.push('/')}
                >
                  Volver al inicio
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
