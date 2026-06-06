import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuthUser } from '@/src/context/AuthUserProvider'
import { getLiveAccessByEmail } from '@/src/lib/liveAccess'

const plans = [
  {
    id: 'week',
    days: '5 DÍAS',
    title: 'Acceso al portal por 5 días hábiles de mercado - Operaciones en vivo',
    price: 'US$99',
    note: 'Renovación semanal',
    priceKey: 'NEXT_PUBLIC_STRIPE_PRICE_WEEKLY',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_WEEKLY_ONE_TIME',
    bullets: [
      'Clases en vivo',
      'Operaciones en vivo',
      'Repeticiones y chat en vivo',
      'Biblioteca de recursos',
      'Pago único por 5 días de acceso',
    ],
  },
  {
    id: 'two-weeks',
    days: '10 DÍAS',
    title: 'Acceso al portal por 10 días hábiles de mercado - Operaciones en vivo',
    price: 'US$189',
    note: 'Renovación quincenal',
    priceKey: 'NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS_ONE_TIME',
    bullets: [
      'Clases en vivo',
      'Operaciones en vivo',
      'Repeticiones y chat en vivo',
      'Biblioteca de recursos',
      'Descuento por 10 días de acceso',
    ],
  },
  {
    id: 'month',
    days: '20 DÍAS',
    title: 'Acceso al portal por 20 días hábiles de mercado - Operaciones en vivo',
    price: 'US$369',
    note: 'Renovación mensual',
    priceKey: 'NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS_ONE_TIME',
    featured: true,
    bullets: [
      'Clases en vivo',
      'Operaciones en vivo',
      'Repeticiones y chat en vivo',
      'Biblioteca de recursos',
      'Mejor descuento por 20 días de acceso',
    ],
  },
]

const portalItems = [
  { icon: '▣', title: 'OPERACIONES EN VIVO', text: 'Acompaña cada operación en tiempo real', badge: 'LIVE' },
  { icon: '▶', title: 'REPETICIONES GRABADAS', text: 'Accede a todas las clases y operaciones' },
  { icon: '▥', title: 'ESTRATEGIAS PROBADAS', text: 'Métodos profesionales aplicados en el mercado real' },
  { icon: '▤', title: 'EARNINGS REPORTS', text: 'Análisis antes y después de los reportes' },
  { icon: '◈', title: 'GESTIÓN DE RIESGO', text: 'Aprende a proteger tu capital con reglas claras' },
  { icon: '◉', title: 'BIBLIOTECA DE VIDEOS, DOCUMENTOS, INSTRUCTIVOS Y CHAT LIVE', text: 'Interactúa con el instructor y la comunidad' },
  { icon: '🔔', title: 'ALERTAS DE MERCADO', text: 'Señales y alertas en tiempo real' },
]

const outcomeItems = [
  { icon: '↗', text: 'Serás capaz de duplicar tu cuenta bancaria en tu primer mes de inversiones real.' },
  { icon: '◎', text: 'Identificar el momento preciso de compra y venta para tomar importantes rentabilidades.' },
  { icon: '🏦', text: 'Abrir tu cuenta bancaria en $ en EEUU para inversiones en la bolsa, uso personal o de negocios.' },
  { icon: '◌', text: 'Operaciones en vivo todos los días como acompañamiento para que mires los resultados incluso antes de empezar a operar.' },
  { icon: '🎯', title: '100%', text: 'Enfoque práctico' },
  { icon: 'NYSE', title: 'NYSE', text: 'Operamos en la bolsa de New York' },
]

const intensiveCheckoutHref = (user: unknown) =>
  user
    ? `/checkout-confirm?oneTimePriceKey=${encodeURIComponent('NEXT_PUBLIC_STRIPE_PRICE_INTENSIVE_ONE_TIME')}&title=${encodeURIComponent('Seminario intensivo en vivo de inversiones en Wall Street')}&price=${encodeURIComponent('US$500')}&forcePurchaseType=one_time&hidePurchaseType=1&classesOverride=5&levelOverride=${encodeURIComponent('INTENSIVE_TWO_DAY')}`
    : '/signup'

export default function HomePage() {
  const router = useRouter()
  const { user } = useAuthUser()
  const [accessActive, setAccessActive] = useState(false)
  const [accessPlan, setAccessPlan] = useState<string | null>(null)
  const [classesRemaining, setClassesRemaining] = useState<number | null>(null)
  const [accessStartAt, setAccessStartAt] = useState<string | null>(null)

  useEffect(() => {
    if (!router.isReady) return
    if (router.query.recoverPortal !== '1') return

    try {
      sessionStorage.setItem('lead_portal_recovery_returning', '1')
    } catch {
      // ignore storage errors
    }

    router.push('/dashboard')
  }, [router])

  useEffect(() => {
    let mounted = true

    async function loadAccess() {
      if (!user?.email) {
        if (!mounted) return
        setAccessActive(false)
        setAccessPlan(null)
        setClassesRemaining(null)
        setAccessStartAt(null)
        return
      }

      try {
        const access = await getLiveAccessByEmail(user.email)
        if (!mounted) return
        setAccessActive(access.active)
        setAccessPlan(access.plan ?? null)
        setClassesRemaining(access.classesRemaining ?? null)
        setAccessStartAt(access.accessStartAt ?? null)
      } catch {
        if (!mounted) return
        setAccessActive(false)
        setAccessPlan(null)
        setClassesRemaining(null)
        setAccessStartAt(null)
      }
    }

    loadAccess()

    return () => {
      mounted = false
    }
  }, [user?.email])

  const accessMessage = useMemo(() => {
    const startDate = accessStartAt ? new Date(accessStartAt) : null
    const hasScheduledCourseAccess =
      !accessActive &&
      accessPlan === 'INTENSIVE_TWO_DAY' &&
      classesRemaining !== null &&
      classesRemaining > 0 &&
      startDate !== null &&
      startDate.getTime() > Date.now()

    if (accessActive) return 'Tu acceso al portal está activo.'

    if (hasScheduledCourseAccess) {
      return 'Tu acceso al portal inicia el día del seminario intensivo. Incluye 5 días gratis de acceso a operaciones en vivo.'
    }

    if (classesRemaining === 0) return 'Tu saldo de clases se ha agotado. Renueva tu suscripción para continuar.'

    return 'El acceso a clases en vivo se habilita únicamente para estudiantes con suscripción activa.'
  }, [accessActive, accessPlan, classesRemaining, accessStartAt])

  const paid = router.query.paid === '1'
  const canceled = router.query.canceled === '1'

  return (
    <main className="pageShell">
      <style jsx>{`
        .pageShell {
          min-height: 100vh;
          color: #fff;
          background:
            radial-gradient(circle at 55% 4%, rgba(0, 136, 255, 0.32), transparent 29%),
            radial-gradient(circle at 85% 24%, rgba(0, 93, 255, 0.22), transparent 30%),
            linear-gradient(180deg, rgba(2, 8, 23, 0.68), rgba(1, 5, 15, 0.97)),
            url('/trading-bg.jpg');
          background-size: cover;
          background-position: center top;
          background-attachment: fixed;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          overflow-x: hidden;
        }

        .topBar {
          height: 92px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 42px;
          background: rgba(1, 6, 18, 0.88);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(16px);
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .brand img {
          width: 78px;
          height: 58px;
          object-fit: contain;
        }

        .brandTitle {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .brandSub {
          color: rgba(255, 255, 255, 0.66);
          font-size: 14px;
          margin-top: 4px;
        }

        .nav {
          display: flex;
          gap: 30px;
          align-items: center;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.86);
        }

        .nav a {
          color: inherit;
          text-decoration: none;
        }

        .nav a:first-child {
          color: #38a9ff;
          border-bottom: 2px solid #0c8fff;
          padding-bottom: 8px;
        }

        .topActions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .btnMain,
        .btnGhost,
        .btnBlue,
        .btnDark {
          border-radius: 10px;
          min-height: 48px;
          padding: 0 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-weight: 800;
          text-decoration: none;
          border: 1px solid transparent;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          cursor: pointer;
          white-space: nowrap;
        }

        .btnMain {
          color: #08111f;
          background: linear-gradient(135deg, #f6b913, #d99706);
          box-shadow: 0 16px 36px rgba(245, 178, 16, 0.18);
        }

        .btnBlue {
          color: #fff;
          background: linear-gradient(135deg, #064dff, #008cff);
          box-shadow: 0 0 38px rgba(0, 140, 255, 0.38);
        }

        .btnGhost,
        .btnDark {
          color: #fff;
          background: rgba(7, 15, 31, 0.62);
          border-color: rgba(255, 255, 255, 0.22);
        }

        .btnMain:hover,
        .btnGhost:hover,
        .btnBlue:hover,
        .btnDark:hover {
          transform: translateY(-2px);
        }

        .hero {
          min-height: 690px;
          position: relative;
          display: grid;
          grid-template-columns: minmax(480px, 0.92fr) minmax(310px, 0.42fr);
          gap: 28px;
          align-items: center;
          padding: 58px 42px 28px;
          overflow: hidden;
        }

        .hero::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(1, 7, 20, 0.96) 0%, rgba(2, 8, 23, 0.58) 36%, rgba(2, 8, 23, 0.86) 70%, rgba(2, 8, 23, 0.98) 100%),
            radial-gradient(circle at 55% 38%, rgba(0, 145, 255, 0.18), transparent 36%);
          z-index: 1;
        }

        .hero::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, transparent 0%, rgba(1, 7, 20, 0.22) 54%, rgba(1, 7, 20, 0.98) 100%);
          pointer-events: none;
          z-index: 3;
        }

        .heroVisual {
          position: absolute;
          top: 20px;
          bottom: -30px;
          left: 30%;
          right: 18%;
          background:
            linear-gradient(90deg, rgba(1, 7, 20, 0.94) 0%, rgba(1, 7, 20, 0.06) 20%, rgba(1, 7, 20, 0.06) 72%, rgba(1, 7, 20, 0.92) 100%),
            linear-gradient(180deg, rgba(1, 7, 20, 0.03) 0%, rgba(1, 7, 20, 0.88) 90%),
            url('/alejandro-finol-nyse.jpg');
          background-size: cover;
          background-position: center;
          filter: saturate(1.04) contrast(1.02);
          opacity: 0.9;
          z-index: 0;
          pointer-events: none;
        }

        .heroCopy,
        .seminarPanel {
          position: relative;
          z-index: 4;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(3, 12, 28, 0.62);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .redDot {
          width: 8px;
          height: 8px;
          background: #ff2638;
          border-radius: 999px;
          box-shadow: 0 0 18px rgba(255, 38, 56, 0.85);
        }

        h1 {
          font-size: clamp(48px, 5.4vw, 84px);
          line-height: 0.98;
          letter-spacing: -0.07em;
          margin: 24px 0 22px;
        }

        .blueText {
          color: #1499ff;
          text-shadow: 0 0 32px rgba(0, 140, 255, 0.35);
        }

        .heroText {
          max-width: 640px;
          color: rgba(255, 255, 255, 0.82);
          font-size: 18px;
          line-height: 1.55;
          margin-bottom: 28px;
        }

        .heroActions {
          display: flex;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
        }

        .accessState {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 18px;
          font-size: 14px;
        }

        .greenDot {
          width: 10px;
          height: 10px;
          background: #1be46c;
          border-radius: 999px;
          box-shadow: 0 0 16px rgba(27, 228, 108, 0.75);
        }

        .statusPaid,
        .statusCanceled {
          margin-top: 18px;
          padding: 13px 16px;
          border-radius: 14px;
          font-weight: 800;
          max-width: 620px;
        }

        .statusPaid {
          color: #86efac;
          background: rgba(34, 197, 94, 0.13);
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .statusCanceled {
          color: #fca5a5;
          background: rgba(239, 68, 68, 0.13);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .signature {
          position: absolute;
          right: 32%;
          bottom: 88px;
          text-align: right;
          font-size: 17px;
          color: rgba(255, 255, 255, 0.9);
          z-index: 5;
        }

        .signature strong {
          display: block;
          font-size: 33px;
          color: #f4b313;
          font-family: 'Brush Script MT', 'Segoe Script', cursive;
          font-weight: 400;
          line-height: 1;
          text-shadow: 0 0 22px rgba(244, 179, 19, 0.28);
        }

        .seminarPanel {
          padding: 8px 0 8px 18px;
          min-height: 540px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          overflow: visible;
        }

        .seminarPanel::before {
          content: '';
          position: absolute;
          right: -34px;
          top: 170px;
          width: 380px;
          height: 245px;
          background:
            linear-gradient(90deg, rgba(1, 7, 20, 0) 0%, rgba(1, 7, 20, 0.05) 42%, rgba(1, 7, 20, 0.82) 100%),
            linear-gradient(180deg, rgba(1, 7, 20, 0) 0%, rgba(1, 7, 20, 0.72) 100%),
            url('/wall-street-bull.jpg');
          background-size: cover;
          background-position: center;
          opacity: 0.72;
          filter: saturate(0.95) contrast(1.06);
          mask-image: radial-gradient(ellipse at center, black 42%, rgba(0,0,0,0.82) 60%, transparent 84%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 42%, rgba(0,0,0,0.82) 60%, transparent 84%);
          z-index: -1;
          pointer-events: none;
        }

        .seminarOverline {
          color: #15a7ff;
          text-transform: uppercase;
          font-size: 15px;
          letter-spacing: 0.06em;
          font-weight: 900;
          margin-bottom: 20px;
        }

        .seminarDate {
          font-size: 44px;
          font-weight: 900;
          line-height: 0.95;
          margin-bottom: 16px;
        }

        .seminarTime {
          display: flex;
          align-items: center;
          gap: 12px;
          color: rgba(255, 255, 255, 0.86);
          font-size: 19px;
          margin-bottom: 22px;
        }

        .bullStage { display: none; }

        .seminarTitle {
          font-size: 30px;
          line-height: 1.08;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 22px;
        }

        .seminarPrice {
          color: #1499ff;
          font-size: 42px;
          font-weight: 900;
          margin-bottom: 20px;
          text-shadow: 0 0 28px rgba(0, 140, 255, 0.48);
        }

        .included {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #fff;
          font-weight: 800;
          margin-top: 22px;
          padding: 14px 0 0;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }

        .sectionWrap {
          max-width: 1480px;
          margin: 0 auto;
          padding: 0 36px;
        }

        .planTitle,
        .portalTitle,
        .outcomesTitle {
          position: relative;
          text-align: center;
          color: rgba(255, 255, 255, 0.88);
          font-size: 24px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 26px 0 24px;
        }

        .plansGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 34px;
          max-width: 1280px;
          margin: 0 auto;
        }

        .planCard {
          position: relative;
          padding: 34px 34px 30px;
          min-height: 450px;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(5, 16, 35, 0.86), rgba(2, 8, 23, 0.72));
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          display: flex;
          flex-direction: column;
        }

        .planCard.featured {
          border-color: rgba(0, 145, 255, 0.98);
          box-shadow: 0 0 44px rgba(0, 145, 255, 0.55), inset 0 0 34px rgba(0, 145, 255, 0.08);
        }

        .featuredBadge {
          position: absolute;
          left: 50%;
          top: -17px;
          transform: translateX(-50%);
          padding: 8px 20px;
          border-radius: 9px;
          color: #fff;
          font-size: 12px;
          font-weight: 900;
          background: linear-gradient(135deg, #1c9dff, #075cff);
          box-shadow: 0 0 30px rgba(0, 145, 255, 0.7);
        }

        .planDays {
          text-align: center;
          font-size: 25px;
          font-weight: 500;
          letter-spacing: 0.04em;
        }

        .planSub {
          text-align: center;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.74);
          text-transform: uppercase;
          margin-top: 6px;
        }

        .planPrice {
          margin-top: 28px;
          text-align: center;
          color: #1499ff;
          font-size: 42px;
          font-weight: 900;
        }

        .planNote {
          text-align: center;
          color: rgba(255, 255, 255, 0.64);
          margin: 8px 0 28px;
        }

        .planBullets {
          display: grid;
          gap: 14px;
          margin: 0 0 30px;
          padding: 0;
          list-style: none;
          color: rgba(255, 255, 255, 0.84);
          flex: 1;
        }

        .planBullets li {
          display: grid;
          grid-template-columns: 22px 1fr;
          gap: 8px;
          align-items: start;
        }

        .check {
          color: #159eff;
          font-weight: 900;
        }

        .trustRow {
          display: flex;
          justify-content: center;
          gap: 52px;
          margin: 28px 0 48px;
          color: rgba(255, 255, 255, 0.78);
          font-size: 15px;
        }

        .trustRow span {
          display: inline-flex;
          gap: 8px;
          align-items: center;
        }

        .portalGrid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 14px;
        }

        .portalCard,
        .outcomeCard {
          min-height: 172px;
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(5, 16, 35, 0.84), rgba(2, 8, 23, 0.7));
          border: 1px solid rgba(255, 184, 18, 0.22);
          padding: 20px 16px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .portalCard::before,
        .outcomeCard::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 0%, rgba(0, 145, 255, 0.18), transparent 55%);
          opacity: 0.85;
        }

        .cardContent {
          position: relative;
          z-index: 2;
        }

        .portalIcon,
        .outcomeIcon {
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #169dff;
          font-size: 33px;
          font-weight: 900;
          margin-bottom: 14px;
          text-shadow: 0 0 26px rgba(0, 145, 255, 0.75);
        }

        .portalCard h3 {
          font-size: 16px;
          line-height: 1.15;
          margin: 0 0 10px;
        }

        .portalCard p,
        .outcomeCard p {
          color: rgba(255, 255, 255, 0.62);
          font-size: 13px;
          line-height: 1.38;
          margin: 0;
        }

        .liveBadge {
          position: absolute;
          left: 14px;
          top: 14px;
          z-index: 3;
          background: #ff2937;
          color: #fff;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          font-weight: 900;
        }

        .outcomesGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 18px;
          padding-bottom: 54px;
        }

        .outcomeCard {
          min-height: 150px;
          border-color: rgba(0, 145, 255, 0.12);
        }

        .outcomeCard h3 {
          font-size: 28px;
          margin: 0 0 5px;
        }

        .support {
          text-align: center;
          padding: 0 0 34px;
          color: rgba(255, 255, 255, 0.52);
          font-size: 14px;
        }

        @media (max-width: 1100px) {
          .hero {
            grid-template-columns: 1fr;
          }

          .heroVisual {
            left: 0;
            right: 0;
            opacity: 0.28;
          }

          .signature {
            display: none;
          }

          .seminarPanel {
            min-height: auto;
          }

          .plansGrid,
          .portalGrid,
          .outcomesGrid {
            grid-template-columns: 1fr;
          }

          .nav {
            display: none;
          }
        }
      `}</style>

      <section className="hero">
        <div className="heroVisual" />
        <div className="signature">Con el ingeniero<strong>Alejandro Finol</strong></div>
        <div className="heroCopy">
          <nav className="nav" style={{ marginBottom: 36 }}>
            <a href="#">Inicio</a>
            <a href="#">Cursos⌄</a>
            <a href="#planes">Planes</a>
            <a href="#portal">Operaciones en vivo</a>
            <a href="#resultados">Resultados</a>
            <a href="#">Recursos⌄</a>
            <a href="#">Sobre mí</a>
          </nav>

          <div className="pill">SEMINARIO INTENSIVO EN VIVO <span className="redDot" /></div>
          <h1>
            Aprende a invertir en <span className="blueText">opciones financieras</span> en la bolsa de <span className="blueText">New York</span>
          </h1>
          <p className="heroText">
            Seminario Intensivo en Vivo de Inversiones en la Bolsa de Wall Street. Acceso exclusivo a operaciones reales en vivo, estrategias profesionales, clases en directo, grabaciones, biblioteca y chat privado.
          </p>

          {paid && <div className="statusPaid">✅ Pago procesado correctamente. Tu acceso al portal se activará el día del seminario intensivo.</div>}
          {canceled && <div className="statusCanceled">❌ El pago fue cancelado. Puedes intentarlo nuevamente cuando lo desees.</div>}

          <div className="heroActions">
            <Link href={user ? '/dashboard' : '/signup'} className="btnBlue">ENTRAR AL PORTAL →</Link>
            <a href="#planes" className="btnGhost">VER PLANES DE ACCESO</a>
          </div>

          <p
            className="accessState"
            style={{
              color: accessActive
                ? 'rgba(34, 255, 130, 0.95)'
                : accessPlan === 'INTENSIVE_TWO_DAY' && classesRemaining !== null && classesRemaining > 0
                  ? 'rgba(253, 224, 71, 0.98)'
                  : classesRemaining === 0
                    ? 'rgba(252, 165, 165, 0.98)'
                    : 'rgba(34, 255, 130, 0.95)',
            }}
          >
            <span className="greenDot" /> {accessMessage}
          </p>
        </div>

        <aside className="seminarPanel">
          <div className="seminarOverline">Próximo seminario en vivo</div>
          <div className="seminarDate">20 y 21<br />de Junio</div>
          <div className="seminarTime">◷ <span>12:00 pm<br />Hora de NY</span></div>
          <div className="bullStage" />
          <div className="seminarTitle">Wall Street<br />Options<br />Intensive</div>
          <div className="seminarPrice">US$500</div>
          <Link href={intensiveCheckoutHref(user)} className="btnBlue" style={{ width: '100%', maxWidth: 300 }}>RESERVAR MI CUPO →</Link>
          <div className="included">🎁 <span>INCLUYE 5 DÍAS GRATIS<br />DE ACCESO A OPERACIONES EN VIVO</span></div>
        </aside>
      </section>

      <section id="planes" className="sectionWrap">
        <h2 className="planTitle">ELIGE TU PLAN DE ACCESO</h2>
        <div className="plansGrid">
          {plans.map((plan) => (
            <div key={plan.id} className={`planCard ${plan.featured ? 'featured' : ''}`}>
              {plan.featured && <div className="featuredBadge">★ MÁS ELEGIDO</div>}
              <div className="planDays">{plan.days}</div>
              <div className="planSub">HÁBILES DE MERCADO</div>
              <div className="planPrice">{plan.price}</div>
              <div className="planNote">{plan.note}</div>
              <ul className="planBullets">
                {plan.bullets.map((bullet) => (
                  <li key={bullet}><span className="check">✓</span><span>{bullet}</span></li>
                ))}
              </ul>
              <Link
                href={
                  user
                    ? `/checkout-confirm?subscriptionPriceKey=${encodeURIComponent(plan.priceKey)}&oneTimePriceKey=${encodeURIComponent(plan.oneTimePriceKey)}&title=${encodeURIComponent(plan.title)}&price=${encodeURIComponent(plan.price)}`
                    : '/signup'
                }
                className={plan.featured ? 'btnBlue' : 'btnDark'}
                style={{ width: '100%' }}
              >
                ELEGIR PLAN
              </Link>
            </div>
          ))}
        </div>

        <div className="trustRow">
          <span>ϟ Acceso inmediato</span>
          <span>▱ Pago seguro</span>
          <span>◉ Sin contratos, sin letras pequeñas</span>
        </div>
      </section>

      <section id="portal" className="sectionWrap">
        <h2 className="portalTitle">¿QUÉ VERÁS DENTRO DEL PORTAL?</h2>
        <div className="portalGrid">
          {portalItems.map((item) => (
            <div key={item.title} className="portalCard">
              {item.badge && <span className="liveBadge">{item.badge}</span>}
              <div className="cardContent">
                <div className="portalIcon">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="resultados" className="sectionWrap">
        <h2 className="outcomesTitle">¿QUÉ SERÁS CAPAZ DE HACER DESPUÉS DEL SEMINARIO?</h2>
        <div className="outcomesGrid">
          {outcomeItems.map((item, index) => (
            <div key={`${item.text}-${index}`} className="outcomeCard">
              <div className="cardContent">
                <div className="outcomeIcon">{item.icon}</div>
                {item.title && <h3>{item.title}</h3>}
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="support">Soporte: Escríbenos a Lead@leadacademy.com.ve · WhatsApp: +1 786 620 4377</div>
    </main>
  )
}
