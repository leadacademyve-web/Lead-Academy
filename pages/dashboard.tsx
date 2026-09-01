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

type LiveAudiencePresence = {
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  is_watching: boolean;
  last_seen: string;
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
    title: '$99 x 5 clases de operaciones en vivo',
    description: 'Elige cómo quieres pagar este acceso al portal.',
    buttonLabel: 'Comprar este plan',
    subscriptionPriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_WEEKLY',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_WEEKLY_ONE_TIME',
  },
  {
    key: 'twoWeeks',
    title: '$189 x 10 clases de operaciones en vivo',
    description: 'Elige cómo quieres pagar este acceso al portal.',
    buttonLabel: 'Comprar este plan',
    subscriptionPriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS_ONE_TIME',
  },
  {
    key: 'fourWeeks',
    title: '$369 x 20 clases de operaciones en vivo',
    description: 'Elige cómo quieres pagar este acceso al portal.',
    buttonLabel: 'Comprar este ',
    subscriptionPriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS_ONE_TIME',
  },
  {
    key: 'intensiveApril2026',
    title: '$500 Curso Intensivo + 5 clases gratuitas de operaciones en vivo',
    description: 'Curso intensivo',
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

function formatNYDate() {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      timeZone: 'America/New_York',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  } catch {
    return '';
  }
}

function formatNYTime() {
  try {
    return new Intl.DateTimeFormat('es-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
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


function chatMessageTimestampValue(message: ChatMessage) {
  const ts = new Date(String(message.created_at || '')).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function isNewerChatMessage(message: ChatMessage, previousMessages: ChatMessage[]) {
  if (!previousMessages.length) return false;

  const previousIds = new Set(previousMessages.map((item) => item.id));
  if (previousIds.has(message.id)) return false;

  const newestPreviousTs = Math.max(...previousMessages.map(chatMessageTimestampValue), 0);
  const messageTs = chatMessageTimestampValue(message);

  return !messageTs || !newestPreviousTs || messageTs >= newestPreviousTs;
}

function browserCanNotify() {
  return typeof window !== 'undefined' && 'Notification' in window;
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

const STRATEGY_VIDEO_URLS = {
  aperturaBajista: '',
  aperturaAlcista: '',
  rupturaBajista: '',
  rupturaAlcista: '',
};

function strategyLibraryItem(args: {
  id: string;
  title: string;
  videoUrl: string;
  fallbackImageUrl: string;
}): LibraryItem {
  const videoUrl = args.videoUrl.trim();

  return {
    id: args.id,
    title: args.title,
    kind: videoUrl ? 'video' : 'image',
    url: videoUrl || args.fallbackImageUrl,
    description: videoUrl ? 'Reproducir video' : 'Imagen de estrategia',
  };
}

const LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: 'Plan-inversiones.xlsx',
    title: 'Plan de inversiones Excel',
    kind: 'download',
    url: '/Plan-inversiones.xlsx',
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
  url: 'https://player.vimeo.com/video/1203267471',
  description: 'Reproducir video',
},
  {
    id: 'est-apertura-bajista',
    title: 'Est. Apertura bajista',
    kind: 'video',
  url: 'https://player.vimeo.com/video/1203247156',
  description: 'Reproducir video',
  },
  {
    id: 'est-apertura-alcista',
    title: 'Est. Apertura alcista',
    kind: 'video',
  url: 'https://player.vimeo.com/video/1203261585',
  description: 'Reproducir video',
  },
  {
    id: 'est-ruptura-bajista',
    title: 'Est. Ruptura bajista',
    kind: 'video',
  url: 'https://player.vimeo.com/video/1203247158',
  description: 'Reproducir video',
  },
  {
    id: 'est-ruptura-alcista',
    title: 'Est. Ruptura alcista',
    kind: 'video',
  url: 'https://player.vimeo.com/video/1203247159',
  description: 'Reproducir video',
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


const TODAY_CLASS_TOPIC_KEY = 'today_class_topic';

function isChatAdminEmail(email?: string | null) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;

  const envEmails = normalizeEmailList(process.env.NEXT_PUBLIC_CHAT_ADMIN_EMAILS || '');
  const fallbackEmails = ['lead@leadacademy.com.ve'];
  return [...envEmails, ...fallbackEmails].includes(normalized);
}


type TradeStrategy = string;
type TradeOptionType = 'CALL' | 'PUT';
type LiveTrade = {
  id: string;
  ticker: string;
  option_type: TradeOptionType;
  strategy: TradeStrategy;
  result_pct: number;
  created_at: string;
  live_session_id?: string | null;
  trade_source?: 'REAL' | 'EDUCATIONAL';
};

const DEFAULT_TRADE_STRATEGIES: TradeStrategy[] = ['Apertura Alcista', 'Apertura Bajista', 'Ruptura Alcista', 'Ruptura Bajista'];

function formatPortalNumber(value: number, decimals = 0) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function formatPortalMoney(value: number, signed = false) {
  const n = Number(value || 0);
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}$${formatPortalNumber(n, 2)}`;
}

function tradePct(value: number) {
  const n = Number(value || 0);
  return `${n > 0 ? '+' : ''}${formatPortalNumber(n, 1)}%`;
}

type PortalIconName = 'videos' | 'chat' | 'book' | 'calendar' | 'live' | 'play' | 'classes' | 'profile' | 'support' | 'arrow' | 'download' | 'external' | 'image' | 'wifi' | 'pause';

function PortalIcon({ name, size = 20 }: { name: PortalIconName; size?: number }) {
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
  if (name === 'pause') return <svg {...common}><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
  if (name === 'videos') return <svg {...common}><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m10 8 5 3-5 3z"/></svg>;
  if (name === 'chat') return <svg {...common}><path d="M21 12a8 8 0 0 1-8 8H6l-4 2 1.5-4A8 8 0 1 1 21 12z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>;
  if (name === 'book') return <svg {...common}><path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h6z"/></svg>;
  if (name === 'calendar') return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></svg>;
  if (name === 'live') return <svg {...common}><circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/></svg>;
  if (name === 'play') return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></svg>;
  if (name === 'classes') return <svg {...common}><path d="M3 10 12 5l9 5-9 5z"/><path d="M7 12v5c3 2 7 2 10 0v-5"/></svg>;
  if (name === 'profile') return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
  if (name === 'support') return <svg {...common}><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M4 13H2v5h4v-5zM20 13h2v5h-4v-5z"/><path d="M18 19c-1 2-3 2-5 2"/></svg>;
  if (name === 'download') return <svg {...common}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>;
  if (name === 'external') return <svg {...common}><path d="M14 5h5v5"/><path d="M10 14 19 5"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></svg>;
  if (name === 'image') return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/></svg>;
  return <svg {...common}><path d="M5 12h14M14 7l5 5-5 5"/></svg>;
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
  const [classesPaused, setClassesPaused] = useState(false);
  const [pauseStatusLoading, setPauseStatusLoading] = useState(true);
  const [liveAttendanceConfirmed, setLiveAttendanceConfirmed] = useState(false);
  const [activeLiveSession, setActiveLiveSession] = useState<{ session_id: string; session_started_at: string } | null>(null);
  const [liveSessionLoading, setLiveSessionLoading] = useState(true);
  const [liveAttendanceLoading, setLiveAttendanceLoading] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<ClassVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedLibraryItemId, setSelectedLibraryItemId] = useState<string | null>(null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [activeImageTitle, setActiveImageTitle] = useState<string | null>(null);
  const [chatZoomImageUrl, setChatZoomImageUrl] = useState<string | null>(null);
  const [activeLibraryVideo, setActiveLibraryVideo] = useState<LibraryItem | null>(null);
  const [nowText, setNowText] = useState('');
  const [nyDateText, setNyDateText] = useState('');
  const [todayClassTopic, setTodayClassTopic] = useState('Tema pendiente de publicación');
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
  const [chatSoundEnabled, setChatSoundEnabled] = useState(false);
  const [chatRealtimeStatus, setChatRealtimeStatus] = useState<'conectando' | 'conectado' | 'reconectando' | 'desconectado'>('desconectado');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [chatImageFile, setChatImageFile] = useState<File | null>(null);
  const [chatImagePreviewUrl, setChatImagePreviewUrl] = useState<string | null>(null);
  const [isDragOverChat, setIsDragOverChat] = useState(false);
  const [liveAudience, setLiveAudience] = useState<LiveAudiencePresence[]>([]);
  const [liveAudiencePeak, setLiveAudiencePeak] = useState(0);
  const [adminStudentStats, setAdminStudentStats] = useState({ total: 0, paused: 0 });
  const [adminLiveAction, setAdminLiveAction] = useState<'start' | 'end' | null>(null);
  const [adminLiveWorking, setAdminLiveWorking] = useState(false);
  const [adminLiveNotice, setAdminLiveNotice] = useState<string | null>(null);
  const [showAdminMetrics, setShowAdminMetrics] = useState(true);
  const [showTradeJournal, setShowTradeJournal] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [tradeJournalView, setTradeJournalView] = useState<'resumen' | 'simulador'>('resumen');
  const [simCapital, setSimCapital] = useState('1000');
  const [simMode, setSimMode] = useState<'fixed' | 'protected' | 'compound'>('fixed');
  const [simFixedAmount, setSimFixedAmount] = useState('500');
  const [simPercent, setSimPercent] = useState('50');
  const [simStrategy, setSimStrategy] = useState<'ALL' | TradeStrategy>('ALL');
  const [simOptionType, setSimOptionType] = useState<'ALL' | TradeOptionType>('ALL');
  const [simStartDate, setSimStartDate] = useState('');
  const [simEndDate, setSimEndDate] = useState('');
  const [tradeJournalLoading, setTradeJournalLoading] = useState(false);
  const [tradeJournalError, setTradeJournalError] = useState<string | null>(null);
  const [savingTrade, setSavingTrade] = useState(false);
  const [liveTrades, setLiveTrades] = useState<LiveTrade[]>([]);
  const [tradeStrategies, setTradeStrategies] = useState<TradeStrategy[]>(DEFAULT_TRADE_STRATEGIES);
  const [tradeJournalMode, setTradeJournalMode] = useState<'REAL' | 'EDUCATIONAL'>('REAL');
  const [educationalTradeCount, setEducationalTradeCount] = useState('1000');
  const [educationalWinRate, setEducationalWinRate] = useState('86');
  const [educationalGainMin, setEducationalGainMin] = useState('12');
  const [educationalGainMax, setEducationalGainMax] = useState('15');
  const [educationalLossMin, setEducationalLossMin] = useState('10');
  const [educationalLossMax, setEducationalLossMax] = useState('20');
  const [educationalWorking, setEducationalWorking] = useState(false);
  const [capitalCurveHoverIndex, setCapitalCurveHoverIndex] = useState<number | null>(null);
  const [capitalCurveDragging, setCapitalCurveDragging] = useState(false);
  const [tradeForm, setTradeForm] = useState<{ ticker: string; optionType: TradeOptionType; strategy: TradeStrategy; resultPct: string }>({
    ticker: '', optionType: 'CALL', strategy: DEFAULT_TRADE_STRATEGIES[0], resultPct: ''
  });
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const emojiPanelRef = useRef<HTMLDivElement | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  const chatSoundEnabledRef = useRef(false);
  const userEmailRef = useRef('');
  const activeTabRef = useRef<'videos' | 'chatLive' | 'biblioteca'>('videos');
  const notifiedChatMessageIdsRef = useRef<Set<string>>(new Set());
  const chatAudioContextRef = useRef<AudioContext | null>(null);
  const originalDocumentTitleRef = useRef<string>('');
  const liveVideoIframeRef = useRef<HTMLIFrameElement | null>(null);
  const liveWatchingRef = useRef(false);
  const livePresenceUserIdRef = useRef<string>('');

const streamUrl = useMemo(() => 'https://vimeo.com/event/5863546/embed', []);

  const isChatAdmin = useMemo(() => isChatAdminEmail(userEmail), [userEmail]);

  useEffect(() => {
    if (!isChatAdmin) return;
    let cancelled = false;
    const loadAdminStudentStats = async () => {
      const { data, error } = await supabase.rpc('admin_operational_students');
      if (cancelled || error) return;
      const rows = Array.isArray(data) ? data : [];
      setAdminStudentStats({
        total: rows.filter((row: any) => row?.access_active).length,
        paused: rows.filter((row: any) => row?.access_active && row?.is_paused).length,
      });
    };
    loadAdminStudentStats();
    const timer = window.setInterval(loadAdminStudentStats, 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [isChatAdmin]);


  async function loadTradeStrategies() {
    const { data, error } = await supabase
      .from('trade_strategies')
      .select('name')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) return;
    const names = (data || []).map((row: any) => String(row.name || '').trim()).filter(Boolean);
    if (names.length) {
      setTradeStrategies(names);
      setTradeForm((prev) => names.includes(prev.strategy) ? prev : { ...prev, strategy: names[0] });
    }
  }

  async function loadTradeJournal(showLoading = false, requestedMode?: 'REAL' | 'EDUCATIONAL') {
    if (showLoading) setTradeJournalLoading(true);
    setTradeJournalError(null);

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    const actualIsAdmin = isChatAdminEmail(authUser?.email || userEmail);

    let mode: 'REAL' | 'EDUCATIONAL' = requestedMode || tradeJournalMode;

    if (actualIsAdmin) {
      const { data: modeSetting, error: modeError } = await supabase
        .from('portal_settings')
        .select('value')
        .eq('key', 'trade_journal_mode')
        .maybeSingle();
      mode = !modeError && String(modeSetting?.value || '').toUpperCase() === 'EDUCATIONAL' ? 'EDUCATIONAL' : 'REAL';
    }

    setTradeJournalMode(mode);

    if (!actualIsAdmin && mode === 'EDUCATIONAL') {
      const [{ data, error }, { data: settings }] = await Promise.all([
        supabase
          .from('student_educational_trades')
          .select('id,ticker,option_type,strategy,result_pct,created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('student_educational_settings')
          .select('trade_count,win_rate,gain_min,gain_max,loss_min,loss_max')
          .maybeSingle(),
      ]);

      if (error) {
        setTradeJournalError('No se pudo cargar tu escenario EDUCATIONAL personal. Ejecuta primero el SQL de EDUCATIONAL por estudiante.');
        if (showLoading) setTradeJournalLoading(false);
        return;
      }

      if (settings) {
        setEducationalTradeCount(String(settings.trade_count ?? 1000));
        setEducationalWinRate(String(settings.win_rate ?? 86));
        setEducationalGainMin(String(settings.gain_min ?? 12));
        setEducationalGainMax(String(settings.gain_max ?? 15));
        setEducationalLossMin(String(settings.loss_min ?? 10));
        setEducationalLossMax(String(settings.loss_max ?? 20));
      }

      setLiveTrades((data || []).map((row: any) => ({ ...row, trade_source: 'EDUCATIONAL' })) as LiveTrade[]);
      if (showLoading) setTradeJournalLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('live_trade_journal')
      .select('id,ticker,option_type,strategy,result_pct,created_at,live_session_id,trade_source')
      .eq('trade_source', mode)
      .order('created_at', { ascending: false });
    if (error) {
      setTradeJournalError('No se pudo cargar la bitácora por modo. Ejecuta primero la migración SQL REAL / EDUCACIONAL en Supabase.');
      if (showLoading) setTradeJournalLoading(false);
      return;
    }
    setLiveTrades((data || []) as LiveTrade[]);
    if (showLoading) setTradeJournalLoading(false);
  }

  async function setTradeMode(mode: 'REAL' | 'EDUCATIONAL') {
    if (mode === tradeJournalMode) return;
    setTradeJournalError(null);
    setShowTradeForm(false);

    if (isChatAdmin) {
      const { error } = await supabase.rpc('admin_set_trade_journal_mode', { p_mode: mode });
      if (error) { setTradeJournalError(error.message || 'No se pudo cambiar el modo de la bitácora.'); return; }
      await loadTradeJournal(true, mode);
      return;
    }

    // Student mode is personal/local: it never changes the administrator's global mode.
    setTradeJournalMode(mode);
    await loadTradeJournal(true, mode);
  }

  async function regenerateEducationalTrades() {
    if (educationalWorking || tradeJournalMode !== 'EDUCATIONAL') return;
    const parse = (v: string) => Number(String(v).replace('%','').replace(',','.'));
    const tradeCount=Math.round(parse(educationalTradeCount)), winRate=parse(educationalWinRate), gainMin=parse(educationalGainMin), gainMax=parse(educationalGainMax), lossMin=parse(educationalLossMin), lossMax=parse(educationalLossMax);
    if (![tradeCount,winRate,gainMin,gainMax,lossMin,lossMax].every(Number.isFinite) || tradeCount < 10 || tradeCount > 10000 || winRate < 0 || winRate > 100 || gainMin <= 0 || gainMax < gainMin || lossMin <= 0 || lossMax < lossMin) {
      setTradeJournalError('Revisa los parámetros: cantidad de trades 10–10.000; Win Rate 0–100; ganancias y pérdidas deben ser positivas y el máximo debe ser mayor o igual al mínimo.');
      return;
    }
    setEducationalWorking(true); setTradeJournalError(null);
    const rpcName = isChatAdmin ? 'admin_regenerate_educational_trades' : 'student_regenerate_educational_trades';
    const { error } = await supabase.rpc(rpcName, {
      p_trade_count: tradeCount, p_win_rate: winRate, p_gain_min: gainMin, p_gain_max: gainMax, p_loss_min: lossMin, p_loss_max: lossMax
    });
    if (error) setTradeJournalError(error.message || 'No se pudieron regenerar los trades educativos.');
    else await loadTradeJournal(true, 'EDUCATIONAL');
    setEducationalWorking(false);
  }

  async function saveTradeJournalEntry() {
    if (!isChatAdmin || savingTrade || tradeJournalMode !== 'REAL') return;
    const ticker = tradeForm.ticker.trim().toUpperCase();
    const resultPct = Number(String(tradeForm.resultPct).replace('%', '').replace(',', '.'));
    if (!ticker || !Number.isFinite(resultPct) || resultPct === 0) {
      setTradeJournalError('Completa el ticker y un resultado % distinto de 0.');
      return;
    }
    setSavingTrade(true);
    setTradeJournalError(null);
    const { error } = await supabase.from('live_trade_journal').insert({
      ticker,
      option_type: tradeForm.optionType,
      strategy: tradeForm.strategy,
      result_pct: resultPct,
      live_session_id: activeLiveSession?.session_id || null,
      created_by_email: userEmail || null,
      trade_source: 'REAL',
    });
    if (error) {
      setTradeJournalError(error.message || 'No se pudo guardar el trade.');
      setSavingTrade(false);
      return;
    }
    setTradeForm({ ticker: '', optionType: 'CALL', strategy: 'Apertura Alcista', resultPct: '' });
    setShowTradeForm(false);
    await loadTradeJournal();
    setSavingTrade(false);
  }

  async function deleteTradeJournalEntry(id: string) {
    if (!isChatAdmin || !id || tradeJournalMode !== 'REAL') return;
    if (!window.confirm('¿Eliminar este trade de la bitácora?')) return;
    const { error } = await supabase.from('live_trade_journal').delete().eq('id', id);
    if (error) { setTradeJournalError(error.message || 'No se pudo eliminar el trade.'); return; }
    setLiveTrades((rows) => rows.filter((row) => row.id !== id));
  }

  const tradeStats = useMemo(() => {
    const total = liveTrades.length;
    const winners = liveTrades.filter((t) => Number(t.result_pct) > 0);
    const losers = liveTrades.filter((t) => Number(t.result_pct) < 0);
    const sum = liveTrades.reduce((acc, t) => acc + Number(t.result_pct || 0), 0);
    const avg = total ? sum / total : 0;
    const byStrategy = tradeStrategies.map((strategy) => {
      const rows = liveTrades.filter((t) => t.strategy === strategy);
      const wins = rows.filter((t) => Number(t.result_pct) > 0);
      const losses = rows.filter((t) => Number(t.result_pct) < 0);
      const result = rows.reduce((acc, t) => acc + Number(t.result_pct || 0), 0);
      const avgWin = wins.length ? wins.reduce((a, t) => a + Number(t.result_pct), 0) / wins.length : 0;
      const avgLoss = losses.length ? losses.reduce((a, t) => a + Number(t.result_pct), 0) / losses.length : 0;
      return { strategy, total: rows.length, wins: wins.length, losses: losses.length, winRate: rows.length ? (wins.length / rows.length) * 100 : 0, result, avgWin, avgLoss };
    });
    return { total, winners: winners.length, losers: losers.length, winRate: total ? (winners.length / total) * 100 : 0, sum, avg, byStrategy };
  }, [liveTrades, tradeStrategies]);

  const capitalSimulation = useMemo(() => {
    const initial = Math.max(0, Number(String(simCapital).replace(',', '.')) || 0);
    const fixedAmount = Math.max(0, Number(String(simFixedAmount).replace(',', '.')) || 0);
    const pct = Math.min(100, Math.max(0, Number(String(simPercent).replace(',', '.')) || 0)) / 100;
    const nyDateKey = (iso: string) => {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
      const get = (t: string) => parts.find((x) => x.type === t)?.value || '';
      return `${get('year')}-${get('month')}-${get('day')}`;
    };
    const trades = [...liveTrades].filter((t) => {
      const d = nyDateKey(t.created_at);
      return (!simStartDate || d >= simStartDate) && (!simEndDate || d <= simEndDate) && (simStrategy === 'ALL' || t.strategy === simStrategy) && (simOptionType === 'ALL' || t.option_type === simOptionType);
    }).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let balance = initial, peak = initial, protectedInvestment = initial * pct, maxDrawdown = 0, investedSum = 0;
    const rows = trades.map((t, index) => {
      let investment = 0;
      let note = '';
      if (simMode === 'fixed') investment = Math.min(fixedAmount, balance);
      if (simMode === 'compound') investment = balance * pct;
      if (simMode === 'protected') {
        if (balance < protectedInvestment) {
          protectedInvestment = balance * pct;
          note = 'Reajuste por reserva agotada';
        }
        investment = protectedInvestment;
      }
      const before = balance;
      const pnl = investment * (Number(t.result_pct || 0) / 100);
      balance = Math.max(0, balance + pnl);
      investedSum += investment;
      if (balance > peak) {
        peak = balance;
        if (simMode === 'protected') protectedInvestment = peak * pct;
        if (!note && simMode === 'protected') note = 'Nuevo máximo';
      } else if (simMode === 'protected' && !note) note = 'Monto protegido';
      const dd = peak > 0 ? ((peak - balance) / peak) * 100 : 0;
      maxDrawdown = Math.max(maxDrawdown, dd);
      return { ...t, index: index + 1, before, investment, pnl, balance, drawdown: dd, note };
    });
    const finalBalance = rows.length ? rows[rows.length - 1].balance : initial;
    return { initial, trades, rows, finalBalance, profit: finalBalance - initial, returnPct: initial > 0 ? ((finalBalance - initial) / initial) * 100 : 0, maxDrawdown, avgInvestment: rows.length ? investedSum / rows.length : 0 };
  }, [liveTrades, simCapital, simMode, simFixedAmount, simPercent, simStrategy, simOptionType, simStartDate, simEndDate]);

  const capitalGainLoss = useMemo(() => {
    const totalGains = capitalSimulation.rows.reduce((sum, row) => sum + (row.pnl > 0 ? row.pnl : 0), 0);
    const totalLosses = capitalSimulation.rows.reduce((sum, row) => sum + (row.pnl < 0 ? Math.abs(row.pnl) : 0), 0);
    const net = totalGains - totalLosses;
    const gross = totalGains + totalLosses;
    const ratio = gross > 0 ? (totalGains / gross) * 100 : 0;
    return { totalGains, totalLosses, net, ratio };
  }, [capitalSimulation.rows]);

  async function loadPauseStatus(userId: string, showLoading = false) {
    if (showLoading) setPauseStatusLoading(true);

    const { data, error } = await supabase
      .from('class_pause_state')
      .select('is_paused')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // En la carga inicial fallamos de forma segura.
      // En refrescos silenciosos conservamos el último estado conocido
      // para evitar que el LIVE parpadee por una consulta lenta o temporal.
      if (showLoading) {
        setClassesPaused(true);
        setPauseStatusLoading(false);
      }
      return;
    }

    setClassesPaused(Boolean(data?.is_paused));
    if (showLoading) setPauseStatusLoading(false);
  }

  async function loadActiveLiveSession(showLoading = false) {
    if (showLoading) setLiveSessionLoading(true);

    const { data, error } = await supabase.rpc('get_active_live_class');
    if (error) {
      if (showLoading) setLiveSessionLoading(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const nextSession = row?.session_id
      ? { session_id: String(row.session_id), session_started_at: String(row.session_started_at || '') }
      : null;

    setActiveLiveSession((current) => {
      if (current?.session_id === nextSession?.session_id) return current;
      return nextSession;
    });

    if (showLoading) setLiveSessionLoading(false);
  }

  async function runAdminLiveAction() {
    if (!isChatAdmin || !adminLiveAction || adminLiveWorking) return;
    setAdminLiveWorking(true);
    setAdminLiveNotice(null);

    const rpcName = adminLiveAction === 'start' ? 'admin_start_live_class' : 'admin_end_live_class';
    const { error } = await supabase.rpc(rpcName);

    if (error) {
      setAdminLiveNotice(error.message || 'No se pudo actualizar la sesión LIVE.');
      setAdminLiveWorking(false);
      return;
    }

    const completedAction = adminLiveAction;
    setAdminLiveAction(null);
    await loadActiveLiveSession();
    setAdminLiveNotice(completedAction === 'start' ? 'Clase LIVE iniciada correctamente.' : 'Clase LIVE finalizada correctamente.');
    setAdminLiveWorking(false);
  }

  function liveSessionElapsed() {
    if (!activeLiveSession?.session_started_at) return '';
    const started = new Date(activeLiveSession.session_started_at).getTime();
    if (!Number.isFinite(started)) return '';
    const elapsed = Math.max(0, Date.now() - started);
    const totalSeconds = Math.floor(elapsed / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  async function loadLiveAttendance(liveSessionId: string) {
    if (!liveSessionId || isChatAdmin) {
      setLiveAttendanceConfirmed(Boolean(isChatAdmin));
      setLiveAttendanceLoading(false);
      return;
    }

    setLiveAttendanceLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        setLiveAttendanceConfirmed(false);
        return;
      }

      const { data, error } = await supabase
        .from('live_class_attendance')
        .select('confirmed_at')
        .eq('user_id', user.id)
        .eq('live_class_id', liveSessionId)
        .maybeSingle();

      setLiveAttendanceConfirmed(!error && Boolean(data?.confirmed_at));
    } finally {
      setLiveAttendanceLoading(false);
    }
  }

  async function confirmLiveAttendance() {
    if (
      !selectedVideo?.is_live ||
      !activeLiveSession?.session_id ||
      classesPaused ||
      pauseStatusLoading ||
      liveAttendanceLoading
    ) return;

    setLiveAttendanceLoading(true);
    setAttendanceError(null);

    const { error } = await supabase.rpc('confirm_live_class_attendance', {
      p_live_class_id: activeLiveSession.session_id,
      p_user_name: userName || null,
    });

    if (error) {
      setLiveAttendanceLoading(false);

      if (String(error.message || '').includes('CLASSES_PAUSED')) {
        setClassesPaused(true);
        setShowAttendanceModal(false);
        return;
      }

      if (
        String(error.message || '').includes('NO_ACTIVE_LIVE_CLASS') ||
        String(error.message || '').includes('LIVE_CLASS_NOT_ACTIVE')
      ) {
        setActiveLiveSession(null);
        setShowAttendanceModal(false);
        setAttendanceError(null);
        return;
      }

      setAttendanceError('No pudimos confirmar tu asistencia. Intenta nuevamente.');
      return;
    }

    setLiveAttendanceConfirmed(true);
    setShowAttendanceModal(false);
    setLiveAttendanceLoading(false);
  }

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) || null,
    [videos, selectedVideoId]
  );


  const selectedLibraryItem = useMemo(
    () => LIBRARY_ITEMS.find((item) => item.id === selectedLibraryItemId) || null,
    [selectedLibraryItemId]
  );

function openLibraryItem(item: LibraryItem) {
if (selectedLibraryItemId === item.id && item.kind !== 'download') {    setSelectedLibraryItemId(null);
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
  link.href = encodeURI(item.url);
  link.download = item.url.split('/').pop() || item.title;
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

  async function loadLibraryVideos(accessStartValue: string | null, planValue?: string | null) {
    const query = supabase
      .from('class_videos')
      .select('id,title,description,video_url,published_at,is_live,is_published')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    const shouldFilterByPurchaseDate =
      String(planValue || '').toUpperCase() === 'WEEKLY';

    if (accessStartValue && shouldFilterByPurchaseDate) {
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
      const normalizedVideos = await loadLibraryVideos(access.accessStartAt ?? null, access.plan ?? null).catch(() => {
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
    setNyDateText(formatNYDate());
    const interval = window.setInterval(() => {
      setNowText(formatNYTime());
      setNyDateText(formatNYDate());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    loadTradeJournal(true);
    loadTradeStrategies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTodayClassTopic();
    const interval = window.setInterval(loadTodayClassTopic, 30000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        await loadPauseStatus(user.id, true);

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
          const normalizedVideos = await loadLibraryVideos(access.accessStartAt ?? null, access.plan ?? null).catch(() => {
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
    setShowAttendanceModal(false);
    setAttendanceError(null);

    if (!selectedVideo?.is_live) {
      setLiveAttendanceConfirmed(false);
      return;
    }

    if (isChatAdmin) {
      setLiveAttendanceConfirmed(true);
      return;
    }

    if (!activeLiveSession?.session_id) {
      setLiveAttendanceConfirmed(false);
      return;
    }

    setLiveAttendanceConfirmed(false);
    loadLiveAttendance(activeLiveSession.session_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideoId, isChatAdmin, activeLiveSession?.session_id]);

  useEffect(() => {
    if (!userEmail) return;

    let cancelled = false;

    async function refreshPauseStatus() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user || cancelled) return;
      await loadPauseStatus(user.id);
    }

    const interval = window.setInterval(refreshPauseStatus, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail || !accessActive) return;

    let cancelled = false;

    async function refreshLiveSession() {
      if (cancelled) return;
      await loadActiveLiveSession();
    }

    loadActiveLiveSession(true);
    const interval = window.setInterval(refreshLiveSession, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, accessActive]);

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



  useEffect(() => {
    chatSoundEnabledRef.current = chatSoundEnabled;
  }, [chatSoundEnabled]);

  useEffect(() => {
    userEmailRef.current = String(userEmail || '').trim().toLowerCase();
  }, [userEmail]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

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

  async function toggleChatSound() {
    if (chatSoundEnabledRef.current || chatSoundEnabled) {
      chatSoundEnabledRef.current = false;
      setChatSoundEnabled(false);
      return;
    }

    try {
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass && !chatAudioContextRef.current) {
          chatAudioContextRef.current = new AudioContextClass();
        }

        if (chatAudioContextRef.current?.state === 'suspended') {
          await chatAudioContextRef.current.resume();
        }

        if (browserCanNotify() && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => undefined);
        }
      }

      chatSoundEnabledRef.current = true;
      setChatSoundEnabled(true);
      window.setTimeout(() => {
        playChatNotificationSound(true);
      }, 120);
    } catch {
      chatSoundEnabledRef.current = true;
      setChatSoundEnabled(true);
    }
  }

  function playChatNotificationSound(force = false) {
    if ((!force && !chatSoundEnabledRef.current) || typeof window === 'undefined') return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = chatAudioContextRef.current || (AudioContextClass ? new AudioContextClass() : null);
      if (!audioContext) return;

      chatAudioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => undefined);
      }

      // Sonido #1: ping brillante de dos notas, diseñado para sobresalir
      // claramente sobre el audio de la clase sin ser largo ni molesto.
      const now = audioContext.currentTime + 0.01;
      const masterGain = audioContext.createGain();
      const compressor = audioContext.createDynamicsCompressor();

      compressor.threshold.setValueAtTime(-18, now);
      compressor.knee.setValueAtTime(12, now);
      compressor.ratio.setValueAtTime(5, now);
      compressor.attack.setValueAtTime(0.003, now);
      compressor.release.setValueAtTime(0.18, now);

      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.95, now + 0.008);
      masterGain.gain.setValueAtTime(0.95, now + 0.30);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
      masterGain.connect(compressor);
      compressor.connect(audioContext.destination);

      const notes = [
        { offset: 0.00, duration: 0.16, frequencies: [880, 1760], level: 0.86 },
        { offset: 0.13, duration: 0.25, frequencies: [1175, 2350], level: 0.92 },
      ];

      notes.forEach(({ offset, duration, frequencies, level }) => {
        frequencies.forEach((frequency, harmonicIndex) => {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const startAt = now + offset;
          const endAt = startAt + duration;

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency, startAt);

          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.exponentialRampToValueAtTime(level / (harmonicIndex + 1), startAt + 0.006);
          gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

          oscillator.connect(gain);
          gain.connect(masterGain);
          oscillator.start(startAt);
          oscillator.stop(endAt + 0.01);
        });
      });
    } catch {
      // Some browsers block audio until the user clicks "Activar sonido".
    }
  }

  function showBrowserChatNotification(message: ChatMessage) {
    if (!browserCanNotify() || Notification.permission !== 'granted') return;

    const sender = message.user_name || 'Estudiante';
    const body = message.body ? message.body.slice(0, 120) : 'Envió una imagen en el chat.';

    try {
      const notification = new Notification(`Nuevo mensaje de ${sender}`, {
        body,
        icon: '/favicon.ico',
        tag: `live-chat-${message.id}`,
      });

      notification.onclick = () => {
        window.focus();
        setActiveTab('chatLive');
        notification.close();
      };
    } catch {
      // Ignore notification errors.
    }
  }

  function notifyIncomingChatMessage(message: ChatMessage) {
    const messageId = String(message.id || '');
    if (!messageId) return;

    const senderEmail = String(message.user_email || '').trim().toLowerCase();
    const currentEmail = userEmailRef.current;
    const isOwnMessage = Boolean(currentEmail && senderEmail && senderEmail === currentEmail);

    if (isOwnMessage || notifiedChatMessageIdsRef.current.has(messageId)) return;

    notifiedChatMessageIdsRef.current.add(messageId);

    playChatNotificationSound();
    showBrowserChatNotification(message);

    const pageIsHidden = typeof document !== 'undefined' && document.visibilityState !== 'visible';

    if (activeTabRef.current !== 'chatLive' || pageIsHidden) {
      setUnreadChatCount((count) => count + 1);
    }
  }

  async function loadChatMessages(options?: { silent?: boolean; notify?: boolean }) {
    const silent = Boolean(options?.silent);
    const shouldNotify = options?.notify !== false;

    if (!silent) {
      setChatLoading(true);
    }

    setChatError(null);

    const { data, error } = await supabase
      .from('live_chat_messages')
      .select('id,user_email,user_name,body,image_url,created_at')
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      if (!silent) {
        setChatMessages([]);
      }

      setChatError('No se pudo cargar el chat en vivo. Reintentando automáticamente...');
      setChatLoading(false);
      setChatRealtimeStatus('reconectando');
      return;
    }

    const nextMessages = (data || []) as ChatMessage[];
    const previousMessages = chatMessagesRef.current;
    const previousIds = new Set(previousMessages.map((item) => item.id));

    chatMessagesRef.current = nextMessages;
    setChatMessages(nextMessages);
    setChatLoading(false);
    setChatRealtimeStatus('conectado');

    // Primera carga: solo establece la base actual del chat. No debe sonar por mensajes viejos.
    if (!previousMessages.length) {
      nextMessages.forEach((message) => {
        if (message.id) notifiedChatMessageIdsRef.current.add(message.id);
      });
      return;
    }

    if (!shouldNotify) return;

    const newMessages = nextMessages.filter((message) => {
      const messageId = String(message.id || '');
      return Boolean(messageId && !previousIds.has(messageId));
    });

    newMessages.forEach((message) => {
      notifyIncomingChatMessage(message);
    });

    if (notifiedChatMessageIdsRef.current.size > 300) {
      const latestIds = nextMessages.slice(-120).map((message) => message.id).filter(Boolean);
      notifiedChatMessageIdsRef.current = new Set(latestIds);
    }
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


  async function publishLivePresence(isWatching = liveWatchingRef.current) {
    if (!accessActive || !userEmail) return;

    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      livePresenceUserIdRef.current = user.id;
      liveWatchingRef.current = Boolean(isWatching && selectedVideo?.is_live);

      await supabase.from('live_audience_presence').upsert(
        {
          user_id: user.id,
          user_email: user.email || userEmail || null,
          user_name: userName || getDisplayName(user),
          is_watching: liveWatchingRef.current,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch {
      // Presence is auxiliary and must never interrupt the portal.
    }
  }

  async function loadLiveAudience() {
    if (!isChatAdmin) return;


    const cutoff = new Date(Date.now() - 45_000).toISOString();
    const { data, error } = await supabase
      .from('live_audience_presence')
      .select('user_id,user_email,user_name,is_watching,last_seen')
      .gte('last_seen', cutoff)
      .order('last_seen', { ascending: false });

    if (error) {
      return;
    }

    const rows = (data || []) as LiveAudiencePresence[];
    setLiveAudience(rows);
    const watchingNow = rows.filter((row) => row.is_watching).length;
    setLiveAudiencePeak((peak) => Math.max(peak, watchingNow));
  }

  function subscribeToVimeoPlaybackEvents() {
    const iframe = liveVideoIframeRef.current;
    if (!iframe?.contentWindow || !selectedVideo?.is_live) return;

    ['play', 'pause', 'ended'].forEach((eventName) => {
      iframe.contentWindow?.postMessage(
        { method: 'addEventListener', value: eventName },
        '*'
      );
    });
  }

  async function loadTodayClassTopic() {
    const { data, error } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', TODAY_CLASS_TOPIC_KEY)
      .maybeSingle();

    if (!error) {
      const topic = String(data?.value || '').trim();
      setTodayClassTopic(topic || 'Tema pendiente de publicación');
    }
  }

  useEffect(() => {
    if (!accessActive || !userEmail) return;

    publishLivePresence(false);
    const heartbeat = window.setInterval(() => {
      publishLivePresence(liveWatchingRef.current);
    }, 15000);

    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
        liveWatchingRef.current = false;
        publishLivePresence(false);
      } else {
        publishLivePresence(liveWatchingRef.current);
      }
    }

    function handleBeforeUnload() {
      liveWatchingRef.current = false;
      publishLivePresence(false);
    }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      liveWatchingRef.current = false;
      publishLivePresence(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessActive, userEmail, userName, selectedVideoId]);

  useEffect(() => {
    function handleVimeoMessage(event: MessageEvent) {
      if (!selectedVideo?.is_live) return;
      if (typeof event.data !== 'object' || !event.data) return;

      const eventName = String((event.data as any).event || '');
      if (eventName === 'play') {
        liveWatchingRef.current = true;
        publishLivePresence(true);
      } else if (eventName === 'pause' || eventName === 'ended') {
        liveWatchingRef.current = false;
        publishLivePresence(false);
      }
    }

    window.addEventListener('message', handleVimeoMessage);
    return () => window.removeEventListener('message', handleVimeoMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideoId, accessActive, userEmail]);

  useEffect(() => {
    if (!isChatAdmin || !accessActive) return;

    loadLiveAudience();
    const interval = window.setInterval(loadLiveAudience, 10000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatAdmin, accessActive]);

  useEffect(() => {
    if (!accessActive) return;

    loadChatMessages({ notify: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessActive]);

  useEffect(() => {
    if (!accessActive) {
      setChatRealtimeStatus('desconectado');
      return;
    }

    setChatRealtimeStatus('conectando');

    const channel = supabase
      .channel(`leadacademy-live-chat-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_chat_messages' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            notifyIncomingChatMessage(payload.new as ChatMessage);
          }
          loadChatMessages({ silent: true });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChatRealtimeStatus('conectado');
          loadChatMessages({ silent: true });
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setChatRealtimeStatus('reconectando');
        }
      });

    const pollingInterval = window.setInterval(() => {
      loadChatMessages({ silent: true });
    }, 5000);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadChatMessages({ silent: true });
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(pollingInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
      setChatRealtimeStatus('desconectado');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessActive, userEmail]);

  useEffect(() => {
    if (activeTab === 'chatLive') {
      setUnreadChatCount(0);
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (!originalDocumentTitleRef.current) {
      originalDocumentTitleRef.current = document.title || 'Lead Academy';
    }

    const originalTitle = originalDocumentTitleRef.current;

    if (unreadChatCount > 0) {
      document.title = `(${unreadChatCount}) Nuevo mensaje - ${originalTitle}`;
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.title = originalTitle;
    };
  }, [unreadChatCount]);

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

  const liveAccessBlocked =
    Boolean(selectedVideo?.is_live) &&
    !isChatAdmin &&
    (pauseStatusLoading || classesPaused);

  const liveSessionUnavailable =
    Boolean(selectedVideo?.is_live) &&
    !isChatAdmin &&
    !liveAccessBlocked &&
    !liveSessionLoading &&
    !activeLiveSession;

  const liveAttendanceRequired =
    Boolean(selectedVideo?.is_live) &&
    !isChatAdmin &&
    !liveAccessBlocked &&
    Boolean(activeLiveSession) &&
    !liveAttendanceLoading &&
    !liveAttendanceConfirmed;

  const hasPlayableVideo =
    !!selectedVideo?.video_url &&
    !videoUnavailable &&
    !liveAccessBlocked &&
    !liveSessionUnavailable &&
    !liveAttendanceLoading &&
    !liveAttendanceRequired &&
    (!selectedVideo?.is_live || isChatAdmin || liveAttendanceConfirmed);
  const showIframe = hasPlayableVideo && isEmbedUrl(selectedVideo.video_url);
  const totalClassesForCurrentPlan = totalClassesForPlan(accessPlan);
  const classesUsed =
    totalClassesForCurrentPlan !== null && classesRemaining !== null
      ? Math.max(totalClassesForCurrentPlan - classesRemaining, 0)
      : null;
  const isLiveClassActive = Boolean(activeLiveSession) && !classesPaused;

  return (
    <main
      className="container dashboard"
      style={{
        maxWidth: '100vw',
        width: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        paddingInline: '1vw',
        boxSizing: 'border-box',
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
          gridTemplateColumns: accessActive ? 'minmax(0, 3.65fr) minmax(400px, 1fr)' : undefined,
          alignItems: 'stretch',
          gap: '14px',
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
                  position: 'relative',
                  background: '#000',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03), 0 0 0 1px rgba(96,165,250,0.06), 0 20px 40px rgba(0,0,0,0.28)',
                }}
              >
                <>
                {showTradeJournal ? (
                  <div style={{ position:'absolute', inset:0, zIndex:20, width: '100%', height: '100%', overflow: 'hidden', background: 'linear-gradient(180deg,#061326 0%,#031020 100%)', color: '#fff', padding: 18, display:'flex', flexDirection:'column' }}>
                    <div style={{ marginBottom: 14 }}>
                      <div><div style={{ color: '#a855f7', fontSize: 12, fontWeight: 900, letterSpacing: 1.2 }}>BITÁCORA DE TRADES</div><div style={{ fontSize: 24, fontWeight: 950 }}>{tradeJournalMode==='EDUCATIONAL'?'Escenario estadístico educacional':'Estadísticas acumuladas de estrategias en vivo'}</div></div>
                    </div>
                    {tradeJournalError ? <div className="notice" style={{ marginBottom: 12 }}>{tradeJournalError}</div> : null}
                    <div style={{display:'flex',alignItems:'stretch',justifyContent:'space-between',gap:12,marginBottom:14}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',borderRadius:14,overflow:'hidden',border:'1px solid rgba(114,161,216,.25)',background:'rgba(4,13,28,.76)',minWidth:390}}>
                        {[{key:'resumen' as const,label:'RESUMEN E HISTORIAL'},{key:'simulador' as const,label:'SIMULADOR DE CAPITAL'}].map((tab,index)=>{const active=tradeJournalView===tab.key;return <button key={tab.key} type="button" onClick={()=>{setTradeJournalView(tab.key);if(tab.key==='simulador')setShowTradeForm(false);}} style={{minHeight:48,padding:'0 18px',border:0,borderRight:index===0?'1px solid rgba(114,161,216,.18)':0,background:active?'linear-gradient(180deg,#246fe8,#185ac6)':'transparent',color:active?'#fff':'rgba(255,255,255,.84)',fontSize:12.5,fontWeight:900,cursor:'pointer'}}>{tab.label}</button>})}
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'stretch',flexWrap:'wrap',justifyContent:'flex-end'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 10px',minHeight:48,borderRadius:12,border:'1px solid rgba(96,165,250,.22)',background:'rgba(4,13,28,.76)'}}><span style={{fontSize:11,fontWeight:950,color:tradeJournalMode==='REAL'?'#60a5fa':'rgba(255,255,255,.52)'}}>REAL</span><button type="button" aria-label="Cambiar modo de bitácora" onClick={()=>setTradeMode(tradeJournalMode==='REAL'?'EDUCATIONAL':'REAL')} style={{width:46,height:27,border:0,borderRadius:999,padding:3,cursor:'pointer',background:tradeJournalMode==='EDUCATIONAL'?'#22c55e':'#2563eb',boxShadow:'inset 0 0 0 1px rgba(255,255,255,.15)',transition:'all .18s ease'}}><span style={{display:'block',width:21,height:21,borderRadius:'50%',background:'#fff',boxShadow:'0 2px 5px rgba(0,0,0,.35)',transform:tradeJournalMode==='EDUCATIONAL'?'translateX(19px)':'translateX(0)',transition:'transform .18s ease'}}/></button><span style={{fontSize:11,fontWeight:950,color:tradeJournalMode==='EDUCATIONAL'?'#4ade80':'rgba(255,255,255,.52)'}}>EDUCATIONAL</span></div>
                        {isChatAdmin && tradeJournalView==='resumen' && tradeJournalMode==='REAL' ? <button type="button" className="btn btn-secondary" style={{minHeight:48,padding:'10px 16px',fontSize:14,fontWeight:950,border:'1px solid rgba(77,145,255,.48)',background:'linear-gradient(180deg,rgba(31,94,188,.30),rgba(17,52,108,.26))'}} onClick={() => setShowTradeForm((v) => !v)}>+ Registrar trade</button> : null}
                        <button type="button" className="btn btn-secondary" style={{minHeight:48,padding:'10px 16px',fontSize:14,fontWeight:950,border:'1px solid rgba(77,145,255,.48)',background:'linear-gradient(180deg,rgba(31,94,188,.30),rgba(17,52,108,.26))'}} onClick={() => setShowTradeJournal(false)}>← Volver al video</button>
                      </div>
                    </div>
                    {tradeJournalMode === 'EDUCATIONAL' ? <div style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(105px,1fr)) auto',gap:9,alignItems:'end',margin:'-4px 0 12px',padding:'11px 12px',borderRadius:12,border:'1px solid rgba(34,197,94,.22)',background:'rgba(5,35,45,.72)'}}>{[
                      ['CANTIDAD TRADES',educationalTradeCount,setEducationalTradeCount],['WIN RATE %',educationalWinRate,setEducationalWinRate],['GANANCIA MÍN. %',educationalGainMin,setEducationalGainMin],['GANANCIA MÁX. %',educationalGainMax,setEducationalGainMax],['PÉRDIDA MÍN. %',educationalLossMin,setEducationalLossMin],['PÉRDIDA MÁX. %',educationalLossMax,setEducationalLossMax]
                    ].map(([label,value,setter]:any)=><label key={label} style={{fontSize:10,fontWeight:950,color:'rgba(255,255,255,.72)'}}>{label}<input value={value} onChange={e=>setter(e.target.value)} inputMode={label==='CANTIDAD TRADES'?'numeric':'decimal'} style={{width:'100%',marginTop:6,padding:'10px 11px',borderRadius:9,border:'1px solid rgba(96,165,250,.24)',background:'#07172a',color:'#fff',fontSize:14,fontWeight:900}}/></label>)}<button type="button" disabled={educationalWorking} onClick={regenerateEducationalTrades} style={{minHeight:39,padding:'9px 14px',borderRadius:9,border:'1px solid rgba(34,197,94,.46)',background:'linear-gradient(180deg,#16a34a,#15803d)',color:'#fff',fontSize:11.5,fontWeight:950,cursor:educationalWorking?'wait':'pointer',whiteSpace:'nowrap',opacity:educationalWorking ? .7 : 1}}>{educationalWorking?'GENERANDO...':`REGENERAR ${formatPortalNumber(Math.max(0,Math.round(Number(educationalTradeCount)||0)))}`}</button></div> : null}
                    {tradeJournalView === 'resumen' ? <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column'}}>
                    <div style={{ display: 'grid', gridTemplateColumns: showTradeForm && isChatAdmin ? 'repeat(5,minmax(0,1fr)) 350px' : 'repeat(6,minmax(0,1fr))', gap: showTradeForm && isChatAdmin ? 12 : 9, marginBottom: 14 }}>
                      {[
                        ['TOTAL TRADES', formatPortalNumber(tradeStats.total), '#c084fc'], ['TRADES EXITOSOS', formatPortalNumber(tradeStats.winners), '#4ade80'], ['NO EXITOSOS', formatPortalNumber(tradeStats.losers), '#f87171'],
                        ['WIN RATE GLOBAL', `${formatPortalNumber(tradeStats.winRate, 1)}%`, '#60a5fa'], ['RESULTADO ACUMULADO', tradePct(tradeStats.sum), '#fbbf24'], ['PROMEDIO / TRADE', tradePct(tradeStats.avg), '#60a5fa']
                      ].map(([label,value,color]) => <div key={String(label)} style={{ border:'1px solid rgba(96,165,250,.15)', borderRadius:12, padding:'12px 13px', background:'rgba(6,24,47,.78)' }}><div style={{ color:String(color), fontSize:10, fontWeight:900 }}>{label}</div><div style={{ fontSize:25, fontWeight:950, marginTop:7 }}>{value}</div></div>)}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns: showTradeForm && isChatAdmin ? 'minmax(0,1fr) 350px' : '1fr', gap:12, flex:1, minHeight:0 }}>
                      <div style={{ minWidth:0, minHeight:0, display:'flex', flexDirection:'column' }}>
                        <div style={{ border:'1px solid rgba(96,165,250,.15)', borderRadius:14, overflow:'hidden', background:'rgba(3,16,32,.72)', marginBottom:12 }}>
                          <div style={{ padding:'12px 14px', fontWeight:950, fontSize:15 }}>RENDIMIENTO POR ESTRATEGIA</div>
                          <div style={{ display:'grid', gridTemplateColumns:'1.7fr .55fr .65fr .75fr .8fr 1fr 1fr 1fr', gap:8, padding:'10px 14px', fontSize:14, opacity:.78, fontWeight:850 }}><span>Estrategia</span><span>Trades</span><span>Exitosos</span><span>No exitosos</span><span>Win Rate</span><span>Resultado</span><span>Prom. exitoso</span><span>Prom. no exitoso</span></div>
                          {tradeStats.byStrategy.map((row) => <div key={row.strategy} style={{ display:'grid', gridTemplateColumns:'1.7fr .55fr .65fr .75fr .8fr 1fr 1fr 1fr', gap:8, alignItems:'center', padding:'12px 14px', borderTop:'1px solid rgba(148,163,184,.10)', fontSize:16 }}><strong>{row.strategy}</strong><b>{formatPortalNumber(row.total)}</b><b style={{color:'#4ade80'}}>{formatPortalNumber(row.wins)}</b><b style={{color:'#f87171'}}>{formatPortalNumber(row.losses)}</b><b>{formatPortalNumber(row.winRate, 1)}%</b><b style={{color:row.result>=0?'#4ade80':'#f87171'}}>{tradePct(row.result)}</b><b style={{color:'#4ade80'}}>{tradePct(row.avgWin)}</b><b style={{color:'#f87171'}}>{tradePct(row.avgLoss)}</b></div>)}
                        </div>
                        <div style={{ border:'1px solid rgba(96,165,250,.15)', borderRadius:14, overflow:'hidden', background:'rgba(3,16,32,.72)', flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
                          <div style={{ padding:'12px 14px', fontWeight:950, fontSize:15, display:'flex', justifyContent:'space-between', gap:10 }}><span>TRADES RECIENTES</span><span style={{fontSize:13,opacity:.7,fontWeight:750}}>{liveTrades.length} trades · desplaza para ver más</span></div>
                          <div style={{ display:'grid', gridTemplateColumns:'1.45fr .55fr .6fr 1.2fr .65fr .75fr 32px', gap:8, padding:'10px 14px', fontSize:14, opacity:.78, fontWeight:850, background:'rgba(7,23,42,.96)' }}><span>Fecha / Hora</span><span>Ticker</span><span>Tipo</span><span>Estrategia</span><span>Resultado</span><span>Estado</span><span></span></div>
                          <div style={{flex:1,minHeight:0,overflowY:'auto',scrollbarGutter:'stable'}}>
                          {tradeJournalLoading ? <div style={{padding:18,opacity:.7}}>Cargando bitácora...</div> : liveTrades.length ? liveTrades.map((trade) => <div key={trade.id} style={{ display:'grid', gridTemplateColumns:'1.45fr .55fr .6fr 1.2fr .65fr .75fr 32px', gap:8, alignItems:'center', padding:'11px 14px', borderTop:'1px solid rgba(148,163,184,.10)', fontSize:16 }}><span>{new Date(trade.created_at).toLocaleString('es-US',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit'})} NY</span><b>{trade.ticker}</b><b style={{color:trade.option_type==='CALL'?'#4ade80':'#f87171'}}>{trade.option_type}</b><span>{trade.strategy}</span><b style={{color:Number(trade.result_pct)>0?'#4ade80':'#f87171'}}>{tradePct(Number(trade.result_pct))}</b><span>{Number(trade.result_pct)>0?'🟢 Exitoso':'🔴 No exitoso'}</span>{isChatAdmin && tradeJournalMode==='REAL'?<button onClick={()=>deleteTradeJournalEntry(trade.id)} title="Eliminar" style={{background:'transparent',border:0,color:'#94a3b8',cursor:'pointer'}}>×</button>:<span/>}</div>) : <div style={{padding:18,opacity:.7}}>Aún no hay trades registrados.</div>}
                          </div>
                        </div>
                      </div>
                      {showTradeForm && isChatAdmin ? <div style={{display:'grid',gap:12,alignSelf:'start'}}>
                      <div style={{ border:'1px solid rgba(96,165,250,.18)', borderRadius:14, padding:14, background:'linear-gradient(180deg,rgba(20,39,64,.98),rgba(8,25,45,.98))' }}>
                        <div style={{fontWeight:950,fontSize:16}}>REGISTRAR NUEVO TRADE</div><div style={{fontSize:11,opacity:.72,marginBottom:13}}>Registra únicamente el resultado porcentual.</div>
                        <label style={{fontSize:11,fontWeight:850}}>Ticker *</label><input value={tradeForm.ticker} onChange={(e)=>setTradeForm({...tradeForm,ticker:e.target.value.toUpperCase()})} placeholder="Ej: SPY, QQQ, NVDA" style={{width:'100%',margin:'6px 0 12px',padding:'11px',borderRadius:9,border:'1px solid rgba(148,163,184,.22)',background:'#07172a',color:'#fff'}} />
                        <label style={{fontSize:11,fontWeight:850}}>Tipo *</label><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,margin:'6px 0 12px'}}>{(['CALL','PUT'] as TradeOptionType[]).map(type=><button key={type} onClick={()=>setTradeForm({...tradeForm,optionType:type})} style={{padding:11,borderRadius:9,border:`1px solid ${type==='CALL'?'rgba(74,222,128,.55)':'rgba(248,113,113,.55)'}`,background:tradeForm.optionType===type?(type==='CALL'?'rgba(34,197,94,.16)':'rgba(239,68,68,.16)'):'transparent',color:type==='CALL'?'#4ade80':'#f87171',fontWeight:950,cursor:'pointer'}}>{type}</button>)}</div>
                        <label style={{fontSize:11,fontWeight:850}}>Estrategia *</label><select value={tradeForm.strategy} onChange={(e)=>setTradeForm({...tradeForm,strategy:e.target.value as TradeStrategy})} style={{width:'100%',margin:'6px 0 12px',padding:'11px',borderRadius:9,border:'1px solid rgba(148,163,184,.22)',background:'#07172a',color:'#fff'}}>{tradeStrategies.map(x=><option key={x}>{x}</option>)}</select>
                        <label style={{fontSize:11,fontWeight:850}}>Resultado % *</label><div style={{position:'relative'}}><input value={tradeForm.resultPct} onChange={(e)=>setTradeForm({...tradeForm,resultPct:e.target.value})} placeholder="Ej: +12.5 o -18.7" inputMode="decimal" style={{width:'100%',margin:'6px 0 5px',padding:'11px 34px 11px 11px',borderRadius:9,border:'1px solid rgba(148,163,184,.22)',background:'#07172a',color:'#fff'}}/><span style={{position:'absolute',right:12,top:17,opacity:.7}}>%</span></div><div style={{fontSize:10,color:'#94a3b8',marginBottom:15}}>Usa + para ganancias y - para pérdidas.</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1.2fr',gap:8}}><button className="btn" onClick={()=>setShowTradeForm(false)}>Cancelar</button><button className="btn btn-primary" disabled={savingTrade} onClick={saveTradeJournalEntry}>{savingTrade?'Guardando...':'Guardar trade'}</button></div>
                        <div style={{fontSize:10,opacity:.6,marginTop:10}}>Fecha y hora se guardan automáticamente.</div>
                      </div>
                      <div style={{border:'1px solid rgba(96,165,250,.18)',borderRadius:14,padding:14,background:'rgba(3,16,32,.86)'}}>
                        <div style={{fontWeight:950,fontSize:15,marginBottom:10}}>TOTALES</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1.15fr',gap:10,alignItems:'center'}}>
                          <div style={{display:'grid',gap:8}}>
                            <div><div style={{fontSize:10,fontWeight:900,opacity:.68}}>TOTAL GAINS</div><div style={{fontSize:19,fontWeight:950,color:'#4ade80'}}>{formatPortalMoney(capitalGainLoss.totalGains,true)}</div></div>
                            <div><div style={{fontSize:10,fontWeight:900,opacity:.68}}>TOTAL LOSSES</div><div style={{fontSize:19,fontWeight:950,color:'#f87171'}}>-{formatPortalMoney(capitalGainLoss.totalLosses)}</div></div>
                            <div><div style={{fontSize:10,fontWeight:900,opacity:.68}}>NET GAIN / LOSS</div><div style={{fontSize:19,fontWeight:950,color:capitalGainLoss.net>=0?'#4ade80':'#f87171'}}>{formatPortalMoney(capitalGainLoss.net,true)}</div></div>
                          </div>
                          <div style={{position:'relative',height:105,display:'grid',placeItems:'end center'}}>
                            <svg viewBox="0 0 170 95" style={{position:'absolute',inset:0,width:'100%',height:'100%',overflow:'visible'}} aria-hidden="true">
                              <path d="M15 85 A70 70 0 0 1 155 85" pathLength="100" fill="none" stroke="#dc2626" strokeWidth="18" strokeLinecap="butt"/>
                              <path d="M15 85 A70 70 0 0 1 155 85" pathLength="100" fill="none" stroke="#22c55e" strokeWidth="18" strokeLinecap="butt" strokeDasharray={`${Math.max(0,Math.min(100,capitalGainLoss.ratio))} ${100-Math.max(0,Math.min(100,capitalGainLoss.ratio))}`}/>
                            </svg>
                            <div style={{position:'relative',zIndex:1,textAlign:'center',paddingBottom:2}}><div style={{fontSize:10,fontWeight:900,opacity:.72}}>GAIN/LOSS RATIO</div><div style={{fontSize:26,fontWeight:950,lineHeight:1.05}}>{formatPortalNumber(capitalGainLoss.ratio,1)}%</div></div>
                          </div>
                        </div>
                        <div style={{fontSize:9.5,opacity:.55,marginTop:8}}>Calculado con los parámetros activos del Simulador de Capital.</div>
                      </div>
                      </div> : null}
                    </div>
                    </div> : (
                      <div style={{flex:1,minHeight:0,display:'grid',gap:12,alignContent:'start',overflowY:'auto',overflowX:'hidden',scrollbarGutter:'stable',paddingBottom:2}}>
                        <div style={{border:'1px solid rgba(96,165,250,.18)',borderRadius:14,padding:14,background:'rgba(3,16,32,.72)'}}>
                          <div style={{fontWeight:950,fontSize:18,marginBottom:14}}>CONFIGURAR SIMULACIÓN</div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10}}>
                            <label style={{fontSize:16,fontWeight:950}}>Capital inicial $<input value={simCapital} onChange={e=>setSimCapital(e.target.value)} inputMode="decimal" style={{width:'100%',marginTop:8,padding:'15px 13px',fontSize:17,fontWeight:900,borderRadius:9,border:'1px solid rgba(148,163,184,.22)',background:'#07172a',color:'#fff'}}/></label>
                            {simMode==='fixed'?<label style={{fontSize:16,fontWeight:950}}>Monto por trade $<input value={simFixedAmount} onChange={e=>setSimFixedAmount(e.target.value)} inputMode="decimal" style={{width:'100%',marginTop:8,padding:'15px 13px',fontSize:17,fontWeight:900,borderRadius:9,border:'1px solid rgba(148,163,184,.22)',background:'#07172a',color:'#fff'}}/></label>:<label style={{fontSize:16,fontWeight:950}}>% del capital por trade<input value={simPercent} onChange={e=>setSimPercent(e.target.value)} inputMode="decimal" style={{width:'100%',marginTop:8,padding:'15px 13px',fontSize:17,fontWeight:900,borderRadius:9,border:'1px solid rgba(148,163,184,.22)',background:'#07172a',color:'#fff'}}/></label>}
                            <label style={{fontSize:16,fontWeight:950}}>Desde<input type="date" value={simStartDate} onChange={e=>setSimStartDate(e.target.value)} style={{width:'100%',marginTop:8,padding:'15px 13px',fontSize:16,fontWeight:850,borderRadius:9,border:'1px solid rgba(148,163,184,.22)',background:'#07172a',color:'#fff'}}/></label>
                            <label style={{fontSize:16,fontWeight:950}}>Hasta<input type="date" value={simEndDate} onChange={e=>setSimEndDate(e.target.value)} style={{width:'100%',marginTop:8,padding:'15px 13px',fontSize:16,fontWeight:850,borderRadius:9,border:'1px solid rgba(148,163,184,.22)',background:'#07172a',color:'#fff'}}/></label>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:12}}>
                            {[['fixed','Monto fijo','Misma cantidad en cada trade'],['protected','% protegido','Sube con nuevos máximos; mantiene entrada durante retrocesos'],['compound','Compuesto puro','Recalcula el % sobre el balance después de cada trade']].map(([mode,title,desc])=><button key={mode} onClick={()=>setSimMode(mode as any)} style={{textAlign:'left',padding:'13px 14px',borderRadius:10,border:`1px solid ${simMode===mode?'#60a5fa':'rgba(148,163,184,.20)'}`,background:simMode===mode?'rgba(59,130,246,.14)':'rgba(7,23,42,.7)',color:'#fff',cursor:'pointer'}}><b style={{fontSize:15}}>{title}</b><div style={{fontSize:12,opacity:.76,marginTop:5,lineHeight:1.3}}>{desc}</div></button>)}
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:10}}>
                            <select value={simStrategy} onChange={e=>setSimStrategy(e.target.value as any)} style={{padding:'12px 11px',fontSize:14,fontWeight:750,borderRadius:9,border:'1px solid rgba(148,163,184,.22)',background:'#07172a',color:'#fff'}}><option value="ALL">Todas las estrategias</option>{tradeStrategies.map(x=><option key={x}>{x}</option>)}</select>
                            <select value={simOptionType} onChange={e=>setSimOptionType(e.target.value as any)} style={{padding:'12px 11px',fontSize:14,fontWeight:750,borderRadius:9,border:'1px solid rgba(148,163,184,.22)',background:'#07172a',color:'#fff'}}><option value="ALL">CALL + PUT</option><option>CALL</option><option>PUT</option></select>
                          </div>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(0,1fr))',gap:9}}>{[
                          ['CAPITAL INICIAL',formatPortalMoney(capitalSimulation.initial)],['CAPITAL FINAL',formatPortalMoney(capitalSimulation.finalBalance)],['GANANCIA / PÉRDIDA',formatPortalMoney(capitalSimulation.profit,true)],['RETORNO',tradePct(capitalSimulation.returnPct)],['TRADES',formatPortalNumber(capitalSimulation.rows.length)],['MÁX. DRAWDOWN',`${formatPortalNumber(capitalSimulation.maxDrawdown,1)}%`]
                        ].map(([l,v])=><div key={String(l)} style={{border:'1px solid rgba(96,165,250,.15)',borderRadius:12,padding:'12px 13px',background:'rgba(6,24,47,.78)'}}><div style={{fontSize:11,fontWeight:900,opacity:.72}}>{l}</div><div style={{fontSize:27,fontWeight:950,marginTop:7,lineHeight:1.05}}>{v}</div></div>)}</div>
                        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.35fr) minmax(330px,.65fr)',gap:12,alignItems:'stretch'}}>
                          <div style={{border:'1px solid rgba(96,165,250,.15)',borderRadius:14,padding:14,background:'rgba(3,16,32,.72)',minHeight:230}}>
                            <div style={{display:'grid',gridTemplateColumns:'auto repeat(4,minmax(105px,1fr)) auto',gap:14,alignItems:'center',marginBottom:12}}>
                              <div><div style={{fontWeight:950,fontSize:15}}>CURVA DE CAPITAL</div><div style={{fontSize:10,opacity:.6,marginTop:3}}>Evolución del balance después de cada trade</div></div>
                              <div><div style={{fontSize:9.5,fontWeight:900,opacity:.62}}>TRADES EJECUTADOS</div><div style={{fontSize:17,fontWeight:950,marginTop:3}}>{formatPortalNumber(capitalSimulation.rows.length)} / {formatPortalNumber(capitalSimulation.trades.length)}</div></div>
                              <div><div style={{fontSize:9.5,fontWeight:900,opacity:.62}}>MEJOR BALANCE</div><div style={{fontSize:17,fontWeight:950,marginTop:3}}>{formatPortalMoney(Math.max(capitalSimulation.initial,...capitalSimulation.rows.map(r=>r.balance)))}</div></div>
                              <div><div style={{fontSize:9.5,fontWeight:900,opacity:.62}}>INVERSIÓN PROMEDIO</div><div style={{fontSize:17,fontWeight:950,marginTop:3}}>{formatPortalMoney(capitalSimulation.avgInvestment)}</div></div>
                              <div><div style={{fontSize:9.5,fontWeight:900,opacity:.62}}>MÁX. DRAWDOWN</div><div style={{fontSize:17,fontWeight:950,marginTop:3,color:capitalSimulation.maxDrawdown>0?'#fbbf24':'#fff'}}>{formatPortalNumber(capitalSimulation.maxDrawdown,1)}%</div></div>
                              <div style={{textAlign:'right'}}><div style={{fontSize:11,opacity:.68,fontWeight:900}}>CAPITAL FINAL</div><div style={{fontSize:29,fontWeight:950,color:capitalSimulation.profit>=0?'#4ade80':'#f87171'}}>{formatPortalMoney(capitalSimulation.finalBalance)}</div></div>
                            </div>
                            {capitalSimulation.rows.length ? (()=>{const vals=[capitalSimulation.initial,...capitalSimulation.rows.map(r=>r.balance)];const min=Math.min(...vals),max=Math.max(...vals);const span=Math.max(1,max-min);const pts=vals.map((v,i)=>`${(i/(Math.max(1,vals.length-1)))*100},${92-((v-min)/span)*76}`).join(' ');const hoverIndex=capitalCurveHoverIndex===null?null:Math.max(0,Math.min(vals.length-1,capitalCurveHoverIndex));const hoverValue=hoverIndex===null?null:vals[hoverIndex];const hoverRow=hoverIndex && hoverIndex>0?capitalSimulation.rows[hoverIndex-1]:null;const hoverX=hoverIndex===null?0:(hoverIndex/Math.max(1,vals.length-1))*100;const hoverY=hoverValue===null?0:92-((hoverValue-min)/span)*76;return <div style={{height:150,position:'relative',cursor:capitalCurveDragging?'grabbing':'crosshair',userSelect:'none',touchAction:'none'}} onPointerLeave={()=>{if(!capitalCurveDragging)setCapitalCurveHoverIndex(null);}} onPointerDown={(e)=>{e.currentTarget.setPointerCapture(e.pointerId);setCapitalCurveDragging(true);const rect=e.currentTarget.getBoundingClientRect();const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/Math.max(1,rect.width)));setCapitalCurveHoverIndex(Math.round(ratio*(vals.length-1)));}} onPointerMove={(e)=>{if(e.pointerType!=='mouse'&&!capitalCurveDragging)return;const rect=e.currentTarget.getBoundingClientRect();const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/Math.max(1,rect.width)));setCapitalCurveHoverIndex(Math.round(ratio*(vals.length-1)));}} onPointerUp={(e)=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);setCapitalCurveDragging(false);}} onPointerCancel={()=>setCapitalCurveDragging(false)}><svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{width:'100%',height:'100%',overflow:'visible',pointerEvents:'none'}}><line x1="0" y1="92" x2="100" y2="92" stroke="rgba(148,163,184,.18)" strokeWidth=".5"/><line x1="0" y1="54" x2="100" y2="54" stroke="rgba(148,163,184,.10)" strokeWidth=".5"/><line x1="0" y1="16" x2="100" y2="16" stroke="rgba(148,163,184,.10)" strokeWidth=".5"/><polyline points={pts} fill="none" stroke={capitalSimulation.profit>=0?'#22c55e':'#ef4444'} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/>{hoverIndex!==null?<line x1={hoverX} y1="10" x2={hoverX} y2="92" stroke="rgba(255,255,255,.28)" strokeWidth=".35" vectorEffect="non-scaling-stroke"/>:null}</svg>{hoverIndex!==null?<div style={{position:'absolute',left:`${hoverX}%`,top:`${hoverY}%`,width:9,height:9,borderRadius:'50%',background:capitalSimulation.profit>=0?'#22c55e':'#ef4444',boxShadow:`0 0 0 3px ${capitalSimulation.profit>=0?'rgba(34,197,94,.18)':'rgba(239,68,68,.18)'}`,transform:'translate(-50%,-50%)',pointerEvents:'none',zIndex:2}}/>:null}{hoverIndex!==null&&hoverValue!==null?<div style={{position:'absolute',top:6,left:`${Math.min(78,Math.max(2,hoverX))}%`,transform:hoverX>70?'translateX(-100%)':'translateX(0)',pointerEvents:'none',minWidth:190,padding:'11px 13px',borderRadius:10,border:'1px solid rgba(96,165,250,.35)',background:'rgba(3,13,28,.96)',boxShadow:'0 10px 30px rgba(0,0,0,.35)',fontSize:13,lineHeight:1.45,zIndex:3}}><div style={{fontWeight:950,color:'#fff',fontSize:14}}>{hoverIndex===0?'Capital inicial':`Trade #${formatPortalNumber(hoverIndex)}`}</div><div style={{marginTop:5}}>Balance: <strong style={{fontSize:14}}>{formatPortalMoney(hoverValue)}</strong></div>{hoverRow?<><div>P/L: <strong style={{color:hoverRow.pnl>=0?'#4ade80':'#f87171',fontSize:14}}>{formatPortalMoney(hoverRow.pnl,true)}</strong></div><div>Resultado: <strong style={{color:Number(hoverRow.result_pct)>=0?'#4ade80':'#f87171',fontSize:14}}>{tradePct(Number(hoverRow.result_pct))}</strong></div></>:null}</div>:null}<div style={{position:'absolute',left:0,bottom:-2,fontSize:9,opacity:.55}}>Inicio {formatPortalMoney(capitalSimulation.initial)}</div><div style={{position:'absolute',right:0,bottom:-2,fontSize:9,opacity:.55}}>{formatPortalNumber(capitalSimulation.rows.length)} trades</div></div>})() : <div style={{height:150,display:'grid',placeItems:'center',opacity:.65}}>No hay trades para graficar.</div>}
                          </div>
                          <div style={{border:'1px solid rgba(96,165,250,.15)',borderRadius:14,padding:16,background:'rgba(3,16,32,.72)',display:'grid',gridTemplateColumns:'1fr 1.15fr',gap:14,alignItems:'center'}}>
                            <div>
                              <div style={{fontWeight:950,fontSize:15,marginBottom:12}}>TOTALES</div>
                              <div style={{display:'grid',gap:10}}>
                                <div><div style={{fontSize:10.5,fontWeight:900,opacity:.68}}>TOTAL GAINS</div><div style={{fontSize:21,fontWeight:950,color:'#4ade80'}}>{formatPortalMoney(capitalGainLoss.totalGains,true)}</div></div>
                                <div><div style={{fontSize:10.5,fontWeight:900,opacity:.68}}>TOTAL LOSSES</div><div style={{fontSize:21,fontWeight:950,color:'#f87171'}}>-{formatPortalMoney(capitalGainLoss.totalLosses)}</div></div>
                                <div><div style={{fontSize:10.5,fontWeight:900,opacity:.68}}>NET GAIN / LOSS</div><div style={{fontSize:21,fontWeight:950,color:capitalGainLoss.net>=0?'#4ade80':'#f87171'}}>{formatPortalMoney(capitalGainLoss.net,true)}</div></div>
                              </div>
                            </div>
                            <div style={{position:'relative',height:145,display:'grid',placeItems:'end center'}}>
                              <svg viewBox="0 0 170 100" style={{position:'absolute',inset:0,width:'100%',height:'100%',overflow:'visible'}} aria-hidden="true">
                                <path d="M15 88 A70 70 0 0 1 155 88" pathLength="100" fill="none" stroke="#dc2626" strokeWidth="19" strokeLinecap="butt"/>
                                <path d="M15 88 A70 70 0 0 1 155 88" pathLength="100" fill="none" stroke="#22c55e" strokeWidth="19" strokeLinecap="butt" strokeDasharray={`${Math.max(0,Math.min(100,capitalGainLoss.ratio))} ${100-Math.max(0,Math.min(100,capitalGainLoss.ratio))}`}/>
                              </svg>
                              <div style={{position:'relative',zIndex:1,textAlign:'center',paddingBottom:7}}><div style={{fontSize:11,fontWeight:900,opacity:.72}}>GAIN/LOSS RATIO</div><div style={{fontSize:31,fontWeight:950,lineHeight:1.05}}>{formatPortalNumber(capitalGainLoss.ratio,1)}%</div></div>
                            </div>
                          </div>
                        </div>
                        <div style={{border:'1px solid rgba(96,165,250,.15)',borderRadius:14,overflow:'hidden',background:'rgba(3,16,32,.72)',minHeight:0}}>
                          <div style={{padding:'14px 16px',fontWeight:950,fontSize:17,display:'flex',justifyContent:'space-between',gap:10}}><span>BALANCE TRADE POR TRADE</span><span style={{fontSize:12,opacity:.65,fontWeight:700}}>{formatPortalNumber(capitalSimulation.rows.length)} operaciones · desplaza para ver más</span></div>
                          <div style={{display:'grid',gridTemplateColumns:'.35fr 1.15fr .55fr .55fr 1.15fr .65fr .8fr .75fr .85fr .75fr',gap:9,padding:'13px 14px',fontSize:15,opacity:.88,fontWeight:950,background:'rgba(7,23,42,.96)'}}><span>#</span><span>Fecha</span><span>Ticker</span><span>Tipo</span><span>Estrategia</span><span>Resultado</span><span>Inversión</span><span>P/L $</span><span>Balance</span><span>Estado</span></div>
                          <div style={{height:'clamp(298px,34vh,386px)',maxHeight:'386px',overflowY:'auto',overscrollBehavior:'contain',scrollbarGutter:'stable',paddingBottom:1}}>
                            {capitalSimulation.rows.length?capitalSimulation.rows.map(r=><div key={r.id} style={{display:'grid',gridTemplateColumns:'.35fr 1.15fr .55fr .55fr 1.15fr .65fr .8fr .75fr .85fr .75fr',gap:9,alignItems:'center',padding:'13px 14px',borderTop:'1px solid rgba(148,163,184,.10)',fontSize:16,background:r.pnl>=0?'rgba(34,197,94,.018)':'rgba(239,68,68,.025)'}}><span>{formatPortalNumber(r.index)}</span><span>{new Date(r.created_at).toLocaleDateString('es-US',{timeZone:'America/New_York',month:'2-digit',day:'2-digit',year:'2-digit'})}</span><b>{r.ticker}</b><b>{r.option_type}</b><span>{r.strategy}</span><b style={{color:Number(r.result_pct)>=0?'#4ade80':'#f87171'}}>{tradePct(Number(r.result_pct))}</b><span>{formatPortalMoney(r.investment)}</span><b style={{color:r.pnl>=0?'#4ade80':'#f87171'}}>{formatPortalMoney(r.pnl,true)}</b><b>{formatPortalMoney(r.balance)}</b><span style={{fontSize:14,fontWeight:950,color:r.pnl>=0?'#4ade80':'#fbbf24'}}>{simMode==='protected'?r.note:(r.pnl>=0?'Ganancia':'Retroceso')}</span></div>):<div style={{padding:18,opacity:.7}}>No hay trades para los filtros y fechas seleccionados.</div>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
                {activeTab === 'biblioteca'  && activeLibraryVideo ? (
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
                ) : liveAccessBlocked ? (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
                    <div style={{ maxWidth: 720 }}>
                      <div className="eyebrow" style={{ marginBottom: 12 }}>Clases pausadas</div>
                      <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 42 }}>LIVE bloqueado mientras tus clases estén pausadas</h2>
                      <p className="helper" style={{ fontSize: 18, lineHeight: 1.6, margin: '0 auto 18px' }}>
                        Para entrar a una clase en vivo debes reactivar primero tus clases desde “Mis clases”.
                      </p>
                      <button
                        className="btn btn-primary"
                        onClick={() => router.push('/mis-clases')}
                      >
                        Ir a Mis clases
                      </button>
                    </div>
                  </div>
                ) : liveSessionLoading && selectedVideo?.is_live && !isChatAdmin ? (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
                    <div style={{ maxWidth: 720 }}>
                      <div className="eyebrow" style={{ marginBottom: 12 }}>Clase en vivo</div>
                      <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 42 }}>Verificando clase en vivo...</h2>
                    </div>
                  </div>
                ) : liveSessionUnavailable ? (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
                    <div style={{ maxWidth: 720 }}>
                      <div className="eyebrow" style={{ marginBottom: 12 }}>Clase en vivo</div>
                      <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 42 }}>No hay una clase en vivo activa</h2>
                      <p className="helper" style={{ fontSize: 18, lineHeight: 1.6, margin: '0 auto 18px' }}>
                        Cuando la clase sea iniciada, la confirmación de asistencia aparecerá aquí automáticamente.
                      </p>
                    </div>
                  </div>
                ) : liveAttendanceLoading && selectedVideo?.is_live && !isChatAdmin && activeLiveSession ? (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
                    <div style={{ maxWidth: 720 }}>
                      <div className="eyebrow" style={{ marginBottom: 12 }}>Clase en vivo</div>
                      <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 42 }}>Verificando asistencia...</h2>
                      <p className="helper" style={{ fontSize: 18, lineHeight: 1.6, margin: '0 auto' }}>
                        Estamos validando tu acceso a esta sesión.
                      </p>
                    </div>
                  </div>
                ) : liveAttendanceRequired ? (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
                    <div style={{ maxWidth: 720 }}>
                      <div className="eyebrow" style={{ marginBottom: 12 }}>Clase en vivo</div>
                      <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 42 }}>Confirma tu asistencia para entrar</h2>
                      <p className="helper" style={{ fontSize: 18, lineHeight: 1.6, margin: '0 auto 18px' }}>
                        La transmisión se habilitará después de confirmar tu asistencia a la clase de hoy.
                      </p>
                      <button className="btn btn-primary" onClick={() => { setAttendanceError(null); setShowAttendanceModal(true); }}>
                        Confirmar asistencia y entrar
                      </button>
                    </div>
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
                      ref={liveVideoIframeRef}
                      onLoad={subscribeToVimeoPlaybackEvents}
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
                </>
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
            height: '90vh',
            minHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: 18,
            background: 'linear-gradient(180deg, rgba(6,20,45,0.84) 0%, rgba(3,12,29,0.88) 100%)',
            boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(96,165,250,0.10)',
          }}
        >
          {accessActive ? (
            <>
              {/* RESUMEN SUPERIOR */}
              {isChatAdmin ? (
                <div style={{marginBottom: showAdminMetrics ? 18 : 10}}>
                  <button type="button" onClick={()=>setShowAdminMetrics(v=>!v)} style={{width:'100%',minHeight:32,border:'1px solid rgba(114,161,216,.20)',borderRadius:10,background:'rgba(4,15,31,.58)',color:'rgba(255,255,255,.78)',fontSize:11.5,fontWeight:850,cursor:'pointer',marginBottom:showAdminMetrics?8:0}}>{showAdminMetrics ? '▴ Ocultar métricas administrativas' : '▾ Mostrar métricas administrativas'}</button>
                  {showAdminMetrics ? <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
                    gap: 10,
                    padding: 10,
                    marginBottom: 18,
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, rgba(8,24,48,.94), rgba(5,15,32,.92))',
                    border: '1px solid rgba(114,161,216,.22)',
                    boxShadow: '0 14px 34px rgba(0,0,0,.18)',
                  }}
                >
                  {[
                    { label: 'Estudiantes', value: adminStudentStats.total, icon: 'classes' as PortalIconName, color: '#b46cff', bg: 'rgba(125,65,190,.16)', border: 'rgba(180,108,255,.38)' },
                    { label: 'Presentes LIVE', value: liveAudience.filter((row) => row.is_watching).length, icon: 'live' as PortalIconName, color: '#20e493', bg: 'rgba(0,132,84,.16)', border: 'rgba(32,228,147,.38)' },
                    { label: 'Pausados', value: adminStudentStats.paused, icon: 'pause' as PortalIconName, color: '#ffae21', bg: 'rgba(165,99,0,.16)', border: 'rgba(255,174,33,.38)' },
                    { label: 'Conectados ahora', value: liveAudience.length, icon: 'wifi' as PortalIconName, color: '#58a7ff', bg: 'rgba(27,104,205,.16)', border: 'rgba(88,167,255,.38)' },
                  ].map((item) => (
                    <div key={item.label} style={{ minWidth: 0, minHeight: 98, padding: '10px 7px 9px', borderRadius: 14, display: 'grid', gridTemplateRows: '56px auto', alignItems: 'center', justifyItems: 'center', background: 'rgba(4,15,31,.62)', border: '1px solid rgba(114,161,216,.16)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minWidth: 0 }}>
                        <span style={{ width: 48, height: 48, flex: '0 0 auto', borderRadius: 13, display: 'grid', placeItems: 'center', color: item.color, background: item.bg, border: `1px solid ${item.border}`, boxShadow: `0 0 22px ${item.bg}` }}>
                          <PortalIcon name={item.icon} size={27} />
                        </span>
                        <div style={{ fontSize: 27, lineHeight: 1, fontWeight: 950, color: '#fff', minWidth: 20, textAlign: 'center' }}>{item.value}</div>
                      </div>
                      <div style={{ width: '100%', paddingTop: 4, fontSize: 10.5, lineHeight: 1.12, fontWeight: 850, color: 'rgba(255,255,255,.82)', textAlign: 'center', whiteSpace: 'normal', overflowWrap: 'normal', wordBreak: 'normal' }}>{item.label}</div>
                    </div>
                  ))}
                  </div> : null}
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 14, padding: '19px 19px', marginBottom: 14, borderRadius: 18,
                    background: 'linear-gradient(135deg, rgba(8,24,48,.94), rgba(5,15,32,.92))', border: '1px solid rgba(114,161,216,.22)', boxShadow: '0 14px 34px rgba(0,0,0,.18)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 850, color: 'rgba(255,255,255,.72)', marginBottom: 7 }}>
                      <span style={{ width: 15, height: 15, borderRadius: '50%', border: '1px solid rgba(255,255,255,.35)', display: 'inline-grid', placeItems: 'center', fontSize: 9 }}>i</span>Tus clases
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: classesPaused ? '#f59e0b' : '#18df8b', boxShadow: classesPaused ? '0 0 12px rgba(245,158,11,.45)' : '0 0 12px rgba(24,223,139,.45)' }} />
                      <span style={{ fontSize: 31, lineHeight: 1, fontWeight: 950, color: classesPaused ? '#fbbf24' : '#27e79a' }}>{classesPaused ? 'PAUSADO' : 'ACTIVO'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 16 }}>
                    <div style={{ width: 1, background: 'rgba(255,255,255,.12)' }} />
                    <div style={{ minWidth: 104, textAlign: 'center' }}><div style={{ fontSize: 39, lineHeight: 1, fontWeight: 950 }}>{classesRemaining ?? '—'}</div><div style={{ fontSize: 12, fontWeight: 750, marginTop: 6, color: 'rgba(255,255,255,.75)' }}>clases restantes</div></div>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => router.push('/mis-clases')} style={{ gridColumn: '1 / -1', justifySelf: 'center', minWidth: 230, padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 850, background: 'rgba(255,255,255,.055)' }}>Ver detalles en Mis clases &nbsp; →</button>
                </div>
              )}

              {/* TABS */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
                  gap: 0,
                  marginBottom: 14,
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid rgba(114,161,216,.25)',
                  background: 'rgba(4,13,28,.76)',
                }}
              >
                {[
                  { key: 'videos' as const, label: 'VIDEOS', icon: 'videos' as const },
                  { key: 'chatLive' as const, label: unreadChatCount > 0 ? `CHAT LIVE (${unreadChatCount})` : 'CHAT LIVE', icon: 'chat' as const },
                  { key: 'biblioteca' as const, label: 'BIBLIOTECA', icon: 'book' as const },
                ].map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        minHeight: 56,
                        padding: '0 10px',
                        border: 0,
                        borderRight: tab.key !== 'biblioteca' ? '1px solid rgba(114,161,216,.18)' : 0,
                        background: isActive ? 'linear-gradient(180deg,#246fe8,#185ac6)' : 'transparent',
                        color: isActive ? '#fff' : 'rgba(255,255,255,.84)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 9,
                        fontSize: 12.5,
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      <PortalIcon name={tab.icon} size={25} />
                      <span style={{ whiteSpace: 'nowrap' }}>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {activeTab === 'videos' ? (
                <>
                  {/* PRÓXIMA CLASE */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '56px 1fr auto',
                      gap: 12,
                      alignItems: 'center',
                      padding: '17px 17px',
                      marginBottom: 14,
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, rgba(14,43,78,.86), rgba(7,24,49,.86))',
                      border: '1px solid rgba(80,135,211,.30)',
                    }}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: 13, display: 'grid', placeItems: 'center', color: '#4f91ff', background: 'rgba(28,78,172,.20)', border: '1px solid rgba(55,116,226,.38)' }}>
                      <PortalIcon name="calendar" size={29} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, letterSpacing: 1, fontWeight: 900, color: '#78aaff', marginBottom: 6 }}>CLASE DE HOY</div>
                      <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.28 }}>
                        {todayClassTopic}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.68)', marginTop: 6 }}>Clase diaria · 9:00 AM hora de New York</div>
                    </div>
                    <div style={{ textAlign: 'right', paddingLeft: 10, borderLeft: '1px solid rgba(255,255,255,.10)' }}>
                      <div style={{ fontSize: 10, letterSpacing: .8, fontWeight: 800, color: 'rgba(255,255,255,.58)' }}>HORA NY</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#65a1ff', marginTop: 5 }}>{nowText || '—'}</div>
                      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.62)', marginTop: 4, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{nyDateText || '—'}</div>
                    </div>
                  </div>

                  {/* LIVE DESTACADO */}
                  {visibleLibraryVideos.find((video) => video.is_live) ? (() => {
                    const liveVideo = visibleLibraryVideos.find((video) => video.is_live)!;
                    const selected = selectedVideoId === liveVideo.id;
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (!isChatAdmin && (pauseStatusLoading || classesPaused)) return;
                          setActiveLibraryVideo(null);
                          setSelectedVideoId(liveVideo.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          if (!isChatAdmin && (pauseStatusLoading || classesPaused)) return;
                          setActiveLibraryVideo(null);
                          setSelectedVideoId(liveVideo.id);
                        }}
                        style={{
                          padding: '17px 17px',
                          marginBottom: 14,
                          borderRadius: 16,
                          background: isLiveClassActive
                            ? (selected ? 'linear-gradient(135deg,rgba(0,113,72,.24),rgba(5,23,39,.92))' : 'linear-gradient(135deg,rgba(0,81,53,.18),rgba(5,23,39,.90))')
                            : 'linear-gradient(135deg,rgba(70,78,92,.18),rgba(18,24,34,.90))',
                          border: isLiveClassActive ? '1px solid rgba(17,218,139,.68)' : '1px solid rgba(148,163,184,.25)',
                          boxShadow: isLiveClassActive ? '0 12px 30px rgba(0,94,60,.13)' : '0 12px 30px rgba(0,0,0,.10)',
                          cursor: classesPaused && !isChatAdmin ? 'default' : 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 11 }}>
                          <div style={{ fontSize: 11, fontWeight: 850, color: 'rgba(255,255,255,.72)' }}>CLASE EN VIVO</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 900, color: isLiveClassActive ? '#22e596' : 'rgba(203,213,225,.72)' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isLiveClassActive ? '#22e596' : '#94a3b8' }} /> {isLiveClassActive ? 'EN VIVO' : 'INACTIVA'}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 11, alignItems: 'center' }}>
                          <div style={{ color: isLiveClassActive ? '#17e28f' : '#94a3b8', display: 'grid', placeItems: 'center' }}>
                            <PortalIcon name="live" size={42} />
                          </div>
                          <div>
                            <div style={{ fontSize: 17, fontWeight: 900 }}>{labelForVideo(liveVideo)}</div>
                            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.66)', marginTop: 3 }}>
                              {classesPaused && !isChatAdmin ? 'Tus clases están pausadas' : isLiveClassActive ? 'Clase activa en este momento' : 'No hay una clase activa en este momento'}
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })() : null}

                  {/* REPETICIONES RECIENTES */}
                  <div
                    style={{
                      borderRadius: 16,
                      border: '1px solid rgba(114,161,216,.20)',
                      background: 'linear-gradient(180deg,rgba(7,20,40,.82),rgba(5,15,31,.80))',
                      overflow: 'hidden',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '16px 17px', borderBottom: '1px solid rgba(114,161,216,.14)' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 900, letterSpacing: .9, color: 'rgba(255,255,255,.72)' }}>REPETICIONES RECIENTES</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#6ca7ff' }}>Recientes →</div>
                    </div>

                    <div
                      style={{
                        maxHeight: 248,
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(80,145,235,.55) rgba(4,14,29,.30)',
                      }}
                    >
                    {visibleLibraryVideos.filter((video) => !video.is_live).length ? (
                      visibleLibraryVideos.filter((video) => !video.is_live).map((video) => {
                        const selected = selectedVideoId === video.id;
                        return (
                          <button
                            key={video.id}
                            type="button"
                            onClick={() => {
                              setActiveLibraryVideo(null);
                              setSelectedVideoId(video.id);
                            }}
                            style={{
                              width: '100%',
                              minHeight: 62,
                              padding: '10px 15px',
                              border: 0,
                              borderBottom: '1px solid rgba(114,161,216,.12)',
                              background: selected ? 'rgba(34,94,190,.18)' : 'transparent',
                              color: '#fff',
                              display: 'grid',
                              gridTemplateColumns: '44px 1fr auto',
                              gap: 8,
                              alignItems: 'center',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#629bff', background: 'rgba(47,91,161,.18)', border: '1px solid rgba(89,139,216,.24)' }}>
                              <PortalIcon name="play" size={24} />
                            </span>
                            <span style={{ minWidth: 0, fontSize: 14, lineHeight: 1.3, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {labelForVideo(video)}
                            </span>
                            <span style={{ color: 'rgba(255,255,255,.52)', fontSize: 14 }}>›</span>
                          </button>
                        );
                      })
                    ) : (
                      <div style={{ padding: 13, fontSize: 12, color: 'rgba(255,255,255,.60)' }}>Aún no hay repeticiones publicadas.</div>
                    )}
                    </div>
                  </div>

                  {/* ACCESOS RÁPIDOS */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 10 }}>
                    <button
                      type="button"
                      onClick={() => router.push('/mis-clases')}
                      style={{
                        minHeight: 82,
                        padding: '13px 14px',
                        borderRadius: 13,
                        border: '1px solid rgba(114,161,216,.23)',
                        background: 'linear-gradient(180deg,rgba(14,33,61,.82),rgba(7,20,39,.82))',
                        color: '#fff',
                        display: 'grid',
                        gridTemplateColumns: '46px 1fr',
                        gap: 10,
                        alignItems: 'center',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 42, height: 42, borderRadius: 11, display: 'grid', placeItems: 'center', color: '#4f91ff', background: 'rgba(36,81,167,.19)' }}><PortalIcon name="classes" size={27} /></span>
                      <span><strong style={{ display: 'block', fontSize: 15 }}>Mis clases</strong><small style={{ display: 'block', color: 'rgba(255,255,255,.64)', fontSize: 11.5, lineHeight: 1.4, marginTop: 3 }}>Ver saldo, estado y próximas clases →</small></span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingProfile((prev) => !prev);
                        setProfileError(null);
                        setProfileSuccess(null);
                      }}
                      style={{
                        minHeight: 82,
                        padding: '13px 14px',
                        borderRadius: 13,
                        border: '1px solid rgba(114,161,216,.23)',
                        background: 'linear-gradient(180deg,rgba(14,33,61,.82),rgba(7,20,39,.82))',
                        color: '#fff',
                        display: 'grid',
                        gridTemplateColumns: '46px 1fr',
                        gap: 10,
                        alignItems: 'center',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 42, height: 42, borderRadius: 11, display: 'grid', placeItems: 'center', color: '#4f91ff', background: 'rgba(36,81,167,.19)' }}><PortalIcon name="profile" size={27} /></span>
                      <span><strong style={{ display: 'block', fontSize: 15 }}>Mi perfil</strong><small style={{ display: 'block', color: 'rgba(255,255,255,.64)', fontSize: 11.5, lineHeight: 1.4, marginTop: 3 }}>Editar información personal →</small></span>
                    </button>
                  </div>

                  {isChatAdmin ? (
                    <div style={{
                      marginBottom: 10,
                      padding: '12px 13px',
                      borderRadius: 14,
                      border: activeLiveSession ? '1px solid rgba(239,68,68,.38)' : '1px solid rgba(34,197,94,.30)',
                      background: activeLiveSession
                        ? 'linear-gradient(180deg,rgba(75,20,28,.40),rgba(10,23,42,.90))'
                        : 'linear-gradient(180deg,rgba(10,48,43,.38),rgba(8,23,40,.90))',
                      boxShadow: '0 10px 28px rgba(0,0,0,.16)',
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '46px 1fr auto', gap: 11, alignItems: 'center' }}>
                        <span style={{
                          width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center',
                          color: activeLiveSession ? '#ff6b72' : '#2ee69b',
                          background: activeLiveSession ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)',
                          border: activeLiveSession ? '1px solid rgba(239,68,68,.28)' : '1px solid rgba(16,185,129,.28)',
                        }}><PortalIcon name="live" size={27} /></span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 9.5, fontWeight: 950, letterSpacing: '.7px', color: activeLiveSession ? '#ff8b91' : '#72efbd' }}>
                            {activeLiveSession ? '● CLASE EN CURSO' : 'CONTROL DE CLASE LIVE'}
                          </div>
                          <strong style={{ display: 'block', marginTop: 2, fontSize: 15.5, color: '#fff' }}>
                            {activeLiveSession ? `En vivo · ${liveSessionElapsed()}` : 'Lista para iniciar'}
                          </strong>
                          <small style={{ display: 'block', marginTop: 2, fontSize: 10.5, lineHeight: 1.35, color: 'rgba(255,255,255,.62)' }}>
                            {activeLiveSession ? 'Finaliza cuando termine la clase para cerrar asistencia.' : 'Inicia la sesión para habilitar el registro de asistencia.'}
                          </small>
                        </div>
                        <button
                          type="button"
                          disabled={adminLiveWorking}
                          onClick={() => { setAdminLiveNotice(null); setAdminLiveAction(activeLiveSession ? 'end' : 'start'); }}
                          style={{
                            minWidth: 132, minHeight: 44, padding: '9px 13px', borderRadius: 11,
                            border: activeLiveSession ? '1px solid rgba(248,113,113,.55)' : '1px solid rgba(52,211,153,.48)',
                            background: activeLiveSession ? 'linear-gradient(180deg,#b72b35,#8f1f29)' : 'linear-gradient(180deg,#0ebf79,#07945e)',
                            color: '#fff', fontSize: 12.5, fontWeight: 950, cursor: adminLiveWorking ? 'wait' : 'pointer',
                            boxShadow: activeLiveSession ? '0 7px 18px rgba(185,28,28,.22)' : '0 7px 18px rgba(5,150,105,.20)',
                            opacity: adminLiveWorking ? .65 : 1,
                          }}
                        >
                          {adminLiveWorking ? 'Procesando...' : activeLiveSession ? '■ Finalizar clase' : '▶ Iniciar clase'}
                        </button>
                      </div>
                      {adminLiveNotice ? <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 10.5, color: adminLiveNotice.includes('correctamente') ? '#75efbd' : '#ff9ca1' }}>{adminLiveNotice}</div> : null}
                    </div>
                  ) : null}

                  {isEditingProfile ? (
                    <div
                      style={{
                        padding: '13px',
                        borderRadius: 14,
                        background: 'rgba(255,255,255,.035)',
                        border: '1px solid rgba(114,161,216,.18)',
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                        <div className="eyebrow" style={{ marginBottom: 0, color: '#6ca7ff' }}>MI PERFIL</div>
                        <button type="button" className="btn btn-secondary" style={{ padding: '5px 8px', fontSize: 10 }} onClick={() => setIsEditingProfile(false)}>Cerrar</button>
                      </div>

                      <form onSubmit={updateProfile}>
                        <label className="label" style={{ marginBottom: 8, fontSize: 11 }}>
                          Nombre completo
                          <input className="input" value={profileForm.fullName} onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))} autoComplete="name" required />
                        </label>

                        <label className="label" style={{ marginBottom: 8, fontSize: 11 }}>
                          Número telefónico
                          <div style={{ display: 'grid', gridTemplateColumns: '145px 1fr', gap: 7 }}>
                            <select className="input" value={selectedCountryCode} onChange={(e) => setSelectedCountryCode(e.target.value)} aria-label="Código de país">
                              {COUNTRY_OPTIONS.map((option) => <option key={`${option.code}-${option.label}`} value={option.code}>{option.label}</option>)}
                            </select>
                            <input className="input" type="tel" value={phoneLocal} onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d]/g, ''))} autoComplete="tel-national" inputMode="numeric" placeholder={findCountryByCode(selectedCountryCode).placeholder} />
                          </div>
                        </label>

                        <label className="label" style={{ marginBottom: 8, fontSize: 11 }}>
                          Correo electrónico
                          <input className="input" type="email" value={profileForm.email} onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))} autoComplete="email" required />
                        </label>

                        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
                          <button className="btn btn-primary" type="submit" disabled={savingProfile} style={{ width: '100%', fontSize: 11 }}>{savingProfile ? 'Guardando...' : 'Guardar datos'}</button>
                          <button className="btn btn-ghost" type="button" disabled={savingProfile} style={{ width: '100%', fontSize: 11 }} onClick={() => { setIsEditingProfile(false); setProfileError(null); setProfileSuccess(null); }}>Cancelar</button>
                        </div>

                        {profileError && <p className="error" style={{ marginTop: 8, marginBottom: 0, fontSize: 10.5 }}>{profileError}</p>}
                        {profileSuccess && <p className="success" style={{ marginTop: 8, marginBottom: 0, fontSize: 10.5 }}>{profileSuccess}</p>}
                      </form>
                    </div>
                  ) : null}

                  {lastClassWarning ? (
                    <div style={{ padding: '10px 12px', borderRadius: 13, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.32)', marginBottom: 10, fontSize: 11, lineHeight: 1.4 }}>
                      <strong style={{ color: '#fbbf24' }}>Última clase disponible.</strong> Para seguir accediendo al portal deberás renovar tu suscripción.
                    </div>
                  ) : null}

                  {/* SOPORTE / ADMIN */}
                  <div
                    style={{
                      marginTop: 'auto',
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gap: 8,
                      padding: '9px 11px 10px',
                      borderRadius: 13,
                      background: 'linear-gradient(180deg,rgba(10,27,50,.72),rgba(6,18,35,.72))',
                      border: '1px solid rgba(114,161,216,.16)',
                      fontSize: 10.5,
                      color: 'rgba(255,255,255,.76)',
                    }}
                  >
                    <div style={{ display:'grid', gridTemplateColumns:isChatAdmin?'1fr 1fr':'1fr', gap:8, minWidth:0 }}>
                      <button type="button" className="btn btn-secondary" style={{ width:'100%', minWidth:0, minHeight:44, padding:'10px 10px', fontSize:12.5, fontWeight:950, letterSpacing:'.05px', whiteSpace:'nowrap', border:'1px solid rgba(77,145,255,.48)', background:'linear-gradient(180deg,rgba(31,94,188,.30),rgba(17,52,108,.26))', boxShadow:'0 8px 20px rgba(0,0,0,.14)' }} onClick={() => { setShowTradeJournal(true); setTradeJournalView('resumen'); setShowTradeForm(false); loadTradeJournal(); }}>
                        Bitácora de Trades
                      </button>
                      {isChatAdmin ? <button type="button" className="btn btn-secondary" style={{ width:'100%', minWidth:0, minHeight:44, padding:'10px 10px', fontSize:12.5, fontWeight:950, letterSpacing:'.05px', whiteSpace:'nowrap', border:'1px solid rgba(77,145,255,.48)', background:'linear-gradient(180deg,rgba(31,94,188,.30),rgba(17,52,108,.26))', boxShadow:'0 8px 20px rgba(0,0,0,.14)' }} onClick={() => router.push('/gestion-operativa')}>
                        Gestión Operativa
                      </button> : null}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:9, minWidth:0, flexWrap:'wrap', padding:'3px 2px 0', color:'rgba(255,255,255,.84)' }}>
                      <span style={{ color:'#4f91ff', display:'grid', placeItems:'center', flex:'0 0 auto' }}><PortalIcon name="support" size={20} /></span>
                      <strong style={{ color:'#fff', fontSize:12.5, flex:'0 0 auto' }}>Soporte</strong>
                      <span style={{fontSize:11.5,fontWeight:700,opacity:.9}}>Lead@leadacademy.com.ve</span>
                      <span style={{fontSize:11.5,fontWeight:700,opacity:.9}}>+1 786 620 4377</span>
                    </div>
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
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <h2 style={{ margin: 0, fontSize: 22 }}>Chat Live</h2>
                        <p className="helper" style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.45 }}>
                          Escribe aquí durante la clase. Los mensajes aparecerán en tiempo real y el instructor podrá verlos y/o compartirlos.
                        </p>
                        <p className="helper" style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.45 }}>
                          Estado del chat: <strong>{chatRealtimeStatus}</strong>{chatSoundEnabled ? ' · sonido activo' : ' · sonido apagado'}
                        </p>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isChatAdmin ? '1fr 1fr' : '1fr',
                          gap: 10,
                          alignItems: 'stretch',
                          width: '100%',
                        }}
                      >
                        <button
                          type="button"
                          onClick={toggleChatSound}
                          className="btn btn-ghost"
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                            border: chatSoundEnabled ? '1px solid rgba(34,197,94,0.46)' : '1px solid rgba(245,158,11,0.34)',
                            color: 'rgba(255,255,255,0.92)',
                            background: chatSoundEnabled ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.10)',
                          }}
                        >
                          {chatSoundEnabled ? '🔇 Desactivar sonido' : '🔔 Activar sonido'}
                        </button>

                        {isChatAdmin ? (
                          <button
                            type="button"
                            onClick={clearAllChatMessages}
                            disabled={clearingChat || deletingMessageId !== null || !chatMessages.length}
                            className="btn btn-ghost"
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              fontSize: 12,
                              whiteSpace: 'nowrap',
                              border: '1px solid rgba(239,68,68,0.42)',
                              color: 'rgba(255,255,255,0.92)',
                              background: clearingChat ? 'rgba(239,68,68,0.16)' : 'rgba(239,68,68,0.08)',
                              opacity: clearingChat || deletingMessageId !== null || !chatMessages.length ? 0.72 : 1,
                            }}
                          >
                            {clearingChat ? 'Borrando chat...' : '🗑️ Borrar todo'}
                          </button>
                        ) : null}
                      </div>
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
                                onClick={() => setChatZoomImageUrl(message.image_url)}
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
                                  cursor: 'zoom-in',
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.15, color: '#60a5fa', textTransform: 'uppercase', marginBottom: 4 }}>Recursos</div>
                      <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.05 }}>Biblioteca</h2>
                    </div>
                    <div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', color: '#60a5fa', background: 'rgba(37,99,235,.13)', border: '1px solid rgba(59,130,246,.28)' }}>
                      <PortalIcon name="book" size={23} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, flex: 1, alignContent: 'start' }}>
                    {LIBRARY_ITEMS.map((item) => {
                      const selected = selectedLibraryItemId === item.id;
                      const isExternal = item.kind === 'download' && item.url.startsWith('http');
                      const kindLabel = item.kind === 'video' ? 'VIDEO' : isExternal ? 'LINK' : item.kind === 'download' ? 'DESCARGA' : 'IMAGEN';
                      const actionIcon: PortalIconName = item.kind === 'video' ? 'play' : isExternal ? 'external' : item.kind === 'download' ? 'download' : 'arrow';
                      const itemIcon: PortalIconName = item.kind === 'video' ? 'play' : isExternal ? 'external' : item.kind === 'download' ? 'download' : 'image';
                      return (
                        <button
                          key={item.id}
                          onClick={() => openLibraryItem(item)}
                          title={item.description || item.title}
                          style={{
                            minHeight: 112,
                            textAlign: 'left',
                            padding: '14px 14px 13px',
                            borderRadius: 15,
                            border: selected ? '1px solid rgba(59,130,246,.88)' : '1px solid rgba(112,154,207,.20)',
                            background: selected
                              ? 'linear-gradient(145deg, rgba(37,99,235,.25) 0%, rgba(10,26,49,.96) 72%)'
                              : 'linear-gradient(180deg, rgba(17,35,61,.78) 0%, rgba(10,24,44,.86) 100%)',
                            boxShadow: selected ? '0 0 0 1px rgba(59,130,246,.10), inset 0 1px 0 rgba(255,255,255,.04)' : 'inset 0 1px 0 rgba(255,255,255,.025)',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 10,
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', flex: '0 0 auto', color: selected ? '#bfdbfe' : '#60a5fa', background: selected ? 'rgba(37,99,235,.30)' : 'rgba(37,99,235,.14)', border: selected ? '1px solid rgba(96,165,250,.55)' : '1px solid rgba(59,130,246,.34)', boxShadow: selected ? '0 0 18px rgba(37,99,235,.22), inset 0 1px 0 rgba(255,255,255,.08)' : 'inset 0 1px 0 rgba(255,255,255,.05)' }}>
                              <PortalIcon name={itemIcon} size={25} />
                            </div>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .8, color: selected ? '#93c5fd' : 'rgba(203,220,241,.58)' }}>{kindLabel}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.18, minWidth: 0 }}>{item.title}</div>
                            <div style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', color: selected ? '#bfdbfe' : 'rgba(203,220,241,.78)', background: selected ? 'rgba(37,99,235,.20)' : 'rgba(255,255,255,.035)', border: '1px solid rgba(112,154,207,.14)', flex: '0 0 auto' }}><PortalIcon name={actionIcon} size={19} /></div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
</>
          ) : (
            <>
              <div className="eyebrow">Soporte</div>
              <h2 style={{ marginTop: 12 }}>Clases en Vivo</h2>
              <div className="support-list">
                <div className="support-item"><strong>Acceso:</strong><br />Tener una suscripcion activa o inscribirte en el curso te dara acceso al portal.</div>
                <div className="support-item"><strong>Email de soporte:</strong><br />Lead@leadacademy.com.ve</div>
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

      {chatZoomImageUrl ? (
        <div
          onClick={() => setChatZoomImageUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.72)',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            backdropFilter: 'blur(6px)',
          }}
        >
          <img
            src={chatZoomImageUrl}
            alt="Imagen ampliada del chat"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '92vw',
              maxHeight: '88vh',
              objectFit: 'contain',
              borderRadius: 18,
              boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
            }}
          />

          <button
            type="button"
            onClick={() => setChatZoomImageUrl(null)}
            aria-label="Cerrar imagen ampliada"
            title="Cerrar"
            style={{
              position: 'fixed',
              top: 22,
              right: 28,
              width: 42,
              height: 42,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.22)',
              background: 'rgba(15,23,42,0.85)',
              color: 'white',
              fontSize: 22,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      {showAttendanceModal ? (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !liveAttendanceLoading) setShowAttendanceModal(false);
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(8px)',
            display: 'grid', placeItems: 'center', padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-title"
            style={{
              width: 'min(560px, 94vw)', borderRadius: 24,
              border: '1px solid rgba(255,255,255,.14)',
              background: '#111827', boxShadow: '0 30px 90px rgba(0,0,0,.55)', padding: 28,
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 10 }}>Clase en vivo</div>
            <h2 id="attendance-title" style={{ margin: '0 0 12px', fontSize: 30 }}>Confirmar asistencia</h2>
            <p className="helper" style={{ fontSize: 17, lineHeight: 1.6, margin: '0 0 18px' }}>
              Al confirmar, esta clase quedará registrada como asistida aunque abandones la transmisión posteriormente.
            </p>
            {attendanceError ? (
              <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: 'rgba(220,38,38,.14)' }}>
                {attendanceError}
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" disabled={liveAttendanceLoading}
                onClick={() => setShowAttendanceModal(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={liveAttendanceLoading}
                onClick={confirmLiveAttendance}>
                {liveAttendanceLoading ? 'Confirmando...' : 'Confirmar asistencia y entrar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isChatAdmin && adminLiveAction ? (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget && !adminLiveWorking) setAdminLiveAction(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 10020, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', padding: 20 }}
        >
          <div role="dialog" aria-modal="true" style={{ width: 'min(500px,94vw)', borderRadius: 22, border: '1px solid rgba(255,255,255,.14)', background: '#0b172a', boxShadow: '0 30px 90px rgba(0,0,0,.58)', padding: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 950, letterSpacing: '.8px', color: adminLiveAction === 'start' ? '#5ee7ad' : '#ff858c', marginBottom: 8 }}>{adminLiveAction === 'start' ? 'INICIAR CLASE LIVE' : 'FINALIZAR CLASE LIVE'}</div>
            <h2 style={{ margin: '0 0 9px', fontSize: 24 }}>{adminLiveAction === 'start' ? '¿Iniciar la clase ahora?' : '¿Finalizar la clase actual?'}</h2>
            <p style={{ margin: 0, color: 'rgba(255,255,255,.68)', fontSize: 13.5, lineHeight: 1.55 }}>
              {adminLiveAction === 'start'
                ? 'Se creará una nueva sesión LIVE y quedará habilitado el registro de asistencia de los estudiantes.'
                : 'La sesión quedará cerrada y disponible en Gestión Operativa para asociar la repetición de Vimeo.'}
            </p>
            {adminLiveNotice && !adminLiveNotice.includes('correctamente') ? <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'rgba(220,38,38,.12)', color: '#ffadb1', fontSize: 12 }}>{adminLiveNotice}</div> : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
              <button type="button" disabled={adminLiveWorking} onClick={() => setAdminLiveAction(null)} className="btn btn-secondary" style={{ minHeight: 46, fontWeight: 900 }}>Cancelar</button>
              <button type="button" disabled={adminLiveWorking} onClick={runAdminLiveAction} style={{ minHeight: 46, borderRadius: 11, border: adminLiveAction === 'start' ? '1px solid rgba(52,211,153,.5)' : '1px solid rgba(248,113,113,.5)', background: adminLiveAction === 'start' ? 'linear-gradient(180deg,#0ebf79,#07945e)' : 'linear-gradient(180deg,#b72b35,#8f1f29)', color: '#fff', fontWeight: 950, cursor: adminLiveWorking ? 'wait' : 'pointer', opacity: adminLiveWorking ? .65 : 1 }}>
                {adminLiveWorking ? 'Procesando...' : adminLiveAction === 'start' ? '▶ Sí, iniciar clase' : '■ Sí, finalizar clase'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </main>
  );
}
