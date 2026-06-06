import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuthUser } from '@/src/context/AuthUserProvider'
import { getLiveAccessByEmail } from '@/src/lib/liveAccess'

const plans = [
  {
    id: 'week',
    days: '5 DÍAS',
    title: '5 días hábiles de mercado',
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
    title: '10 días hábiles de mercado',
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
    title: '20 días hábiles de mercado',
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

const heroBenefits = [
  { icon: '📡', title: 'Operaciones', text: 'en vivo cada día' },
  { icon: '📊', title: 'Estrategias con', text: 'Opciones Financieras' },
  { icon: '🛡️', title: 'Gestión profesional', text: 'de riesgo' },
  { icon: '▶️', title: 'Repeticiones y', text: 'biblioteca' },
  { icon: '👥', title: 'Comunidad privada', text: 'de traders' },
  { icon: '🏦', title: 'Orientación para abrir', text: 'tu cuenta en EE.UU.' },
  { icon: '💻', title: 'Entrenamiento con', text: 'Paper Money' },
]

const portalItems = [
  { icon: '🔴', title: 'Operaciones en vivo', text: 'Acompaña cada operación en tiempo real' },
  { icon: '▶️', title: 'Repeticiones grabadas', text: 'Accede a todas las clases y operaciones' },
  { icon: '🧠', title: 'Estrategias de compra y venta', text: 'Estrategias probadas con Opciones Financieras' },
  { icon: '📈', title: 'Earnings Reports', text: 'Análisis antes y después de los reportes' },
  { icon: '🛡️', title: 'Gestión de riesgo', text: 'Protege tu capital con reglas profesionales' },
  { icon: '👥', title: 'Comunidad privada', text: 'Conecta con traders serios y comprometidos' },
  { icon: '🔔', title: 'Alertas de mercado', text: 'Señales y alertas en tiempo real' },
]

const stats = [
  { icon: '👥', value: '+2,500', label: 'Estudiantes activos' },
  { icon: '🏅', value: '+3 Años', label: 'Formando traders' },
  { icon: '⏱️', value: '+1,000', label: 'Horas de contenido' },
  { icon: '📡', value: '+250', label: 'Operaciones en vivo cada mes' },
  { icon: '🎯', value: '100%', label: 'Enfoque práctico' },
  { icon: 'NYSE', value: '', label: 'Operamos en la bolsa de New York' },
]

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

    if (accessActive) {
      return 'Tu acceso al portal está activo.'
    }

    if (hasScheduledCourseAccess) {
      return 'Tu acceso al portal inicia el día del curso intensivo. Si deseas acceso inmediato a las clases en vivo, puedes activar un plan de clases diarias.'
    }

    if (classesRemaining === 0) {
      return 'Tu saldo de clases se ha agotado. Renueva tu suscripción para continuar.'
    }

    return 'El acceso a clases en vivo se habilita únicamente para estudiantes con suscripción activa.'
  }, [accessActive, accessPlan, classesRemaining, accessStartAt])

  const paid = router.query.paid === '1'
  const canceled = router.query.canceled === '1'

  const mainPortalHref = user ? '/dashboard' : '/signup'
  const mainPortalLabel = user ? 'Ir al portal' : 'Crear cuenta'

  return (
    <main className="la-page">
      <section className="la-hero">
        <div className="la-bg-glow la-bg-glow-blue" />
        <div className="la-bg-glow la-bg-glow-gold" />

        <div className="la-hero-content">
          <div className="la-hero-copy">
            <div className="la-pill">OPERACIONES EN VIVO CADA DÍA</div>

            <h1>
              Aprende Trading <span>Operando en Vivo</span>
            </h1>

            <p className="la-main-copy">
              No enseñamos teoría. Operamos diariamente en la Bolsa de New York utilizando Opciones Financieras y mostramos cada entrada, salida y gestión de riesgo en tiempo real.
            </p>

            <div className="la-paper-card">
              <div className="la-paper-icon">🏦</div>
              <p>
                Te orientamos paso a paso para abrir tu cuenta de inversión en Estados Unidos y comenzar a practicar con dinero virtual <strong>(Paper Money)</strong> mientras desarrollas experiencia y confianza antes de operar con capital real.
              </p>
            </div>

            <div className="la-actions">
              <Link href={mainPortalHref} className="la-btn la-btn-primary">
                📡 Ver operaciones en vivo
              </Link>
              <a href="#planes" className="la-btn la-btn-secondary">
                Ver cursos
              </a>
            </div>

            <p className="la-live-status">
              <span /> Transmisiones en vivo: <strong>Lunes a Viernes</strong>
            </p>

            {paid && (
              <div className="la-alert la-alert-success">
                ✅ Pago procesado correctamente. Tu acceso al portal se activará el día del curso intensivo.
              </div>
            )}

            {canceled && (
              <div className="la-alert la-alert-danger">
                ❌ El pago fue cancelado. Puedes intentarlo nuevamente cuando lo desees.
              </div>
            )}

            <div className="la-access-message">{accessMessage}</div>
          </div>

          <div className="la-hero-photo-wrap">
            <div className="la-photo-halo" />
            <img src="/alejandro-finol.jpg" alt="Ingeniero Alejandro Finol" className="la-hero-photo" />
            <div className="la-mentor-card">
              <div>Con el ingeniero</div>
              <strong>Alejandro Finol</strong>
              <ul>
                <li>+8 Años de experiencia</li>
                <li>Miles de estudiantes</li>
                <li>Resultados comprobados</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="la-strip">
        {heroBenefits.map((item) => (
          <div className="la-strip-item" key={item.title}>
            <div className="la-strip-icon">{item.icon}</div>
            <div>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="la-course">
        <div className="la-course-left">
          <div className="la-pill la-pill-blue">CURSO INTENSIVO ONLINE EN VIVO</div>
          <h2>
            CURSO DE INVERSIONES <br /> EN LA BOLSA DE <span>NEW YORK</span>
          </h2>

          <div className="la-date-row">
            <div className="la-date-icon">📅</div>
            <div>
              <strong>20 Y 21 DE JUNIO</strong>
              <span>12:00 PM (HORA DE NY)</span>
            </div>
          </div>

          <p>
            Aprende a operar en NYSE con estrategias reales y de la primera mano para generar ingresos diarios con opciones financieras.
          </p>
        </div>

        <div className="la-course-center" aria-hidden="true">
          <img src="/curso-intensivo-online.jpg" alt="Curso intensivo online" />
        </div>

        <div className="la-course-right">
          <ul>
            <li>2 días hábiles de acceso al portal</li>
            <li>Operaciones reales en vivo</li>
            <li>Estrategias probadas</li>
            <li>Gestión de riesgo y mentalidad</li>
            <li>Comunidad privada y soporte continuo</li>
            <li>Material y grabaciones exclusivas</li>
          </ul>

          <Link
            href={
              user
                ? `/checkout-confirm?oneTimePriceKey=${encodeURIComponent('NEXT_PUBLIC_STRIPE_PRICE_INTENSIVE_ONE_TIME')}&title=${encodeURIComponent('Curso intensivo online en vivo - 5 clases')}&price=${encodeURIComponent('US$500')}&forcePurchaseType=one_time&hidePurchaseType=1&classesOverride=5&levelOverride=${encodeURIComponent('INTENSIVE_TWO_DAY')}`
                : '/signup'
            }
            className="la-btn la-btn-blue"
          >
            Inscribirme al curso →
          </Link>
        </div>
      </section>

      <section className="la-plans" id="planes">
        <div className="la-section-title">
          <h2>ELIGE TU PLAN DE ACCESO</h2>
          <span>ACCESO INMEDIATO</span>
        </div>

        <div className="la-plan-grid">
          {plans.map((plan) => (
            <article className={`la-plan-card ${plan.featured ? 'la-plan-featured' : ''}`} key={plan.id}>
              {plan.featured && <div className="la-featured-badge">MÁS ELEGIDO ★</div>}

              <h3>{plan.days}</h3>
              <p className="la-plan-subtitle">DE MERCADO</p>
              <div className="la-plan-price">{plan.price}</div>
              <p className="la-plan-note">{plan.note}</p>

              <ul>
                {plan.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>

              <Link
                href={
                  user
                    ? `/checkout-confirm?subscriptionPriceKey=${encodeURIComponent(plan.priceKey)}&oneTimePriceKey=${encodeURIComponent(plan.oneTimePriceKey)}&title=${encodeURIComponent(plan.title)}&price=${encodeURIComponent(plan.price)}`
                    : '/signup'
                }
                className={`la-btn ${plan.featured ? 'la-btn-primary' : 'la-btn-dark'}`}
              >
                Elegir plan
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="la-inside">
        <h2>¿QUÉ VERÁS DENTRO DEL PORTAL?</h2>

        <div className="la-inside-grid">
          {portalItems.map((item) => (
            <article className="la-inside-card" key={item.title}>
              <div className="la-inside-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="la-stats">
        {stats.map((item) => (
          <div className="la-stat" key={`${item.icon}-${item.label}`}>
            <div className="la-stat-icon">{item.icon}</div>
            {item.value && <strong>{item.value}</strong>}
            <span>{item.label}</span>
          </div>
        ))}
      </section>

      <footer className="la-footer">
        Soporte: Escríbenos a Lead@leadacademy.com.ve · WhatsApp: +1 786 620 4377
      </footer>

      <style jsx>{`
        .la-page {
          min-height: 100vh;
          color: #ffffff;
          background:
            linear-gradient(180deg, rgba(2, 6, 23, 0.68) 0%, rgba(2, 6, 23, 0.95) 42%, rgba(2, 6, 23, 1) 100%),
            url('/trading-bg.jpg') center top / cover fixed no-repeat;
          overflow: hidden;
        }

        .la-hero {
          position: relative;
          min-height: 620px;
          padding: 58px 4vw 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .la-bg-glow {
          position: absolute;
          border-radius: 999px;
          filter: blur(70px);
          opacity: 0.5;
          pointer-events: none;
        }

        .la-bg-glow-blue {
          width: 380px;
          height: 380px;
          right: 18%;
          top: 80px;
          background: rgba(37, 99, 235, 0.45);
        }

        .la-bg-glow-gold {
          width: 300px;
          height: 300px;
          left: 12%;
          bottom: -80px;
          background: rgba(234, 179, 8, 0.18);
        }

        .la-hero-content {
          position: relative;
          z-index: 1;
          max-width: 1520px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(480px, 0.95fr) minmax(460px, 1.05fr);
          gap: 40px;
          align-items: center;
        }

        .la-hero-copy {
          max-width: 640px;
        }

        .la-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(234, 179, 8, 0.55);
          background: rgba(2, 6, 23, 0.55);
          color: #facc15;
          border-radius: 999px;
          padding: 9px 18px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.02em;
          box-shadow: 0 0 28px rgba(234, 179, 8, 0.16);
        }

        .la-pill-blue {
          color: #bfdbfe;
          border-color: rgba(59, 130, 246, 0.7);
          background: rgba(37, 99, 235, 0.35);
        }

        .la-hero h1 {
          margin: 24px 0 18px;
          font-size: clamp(48px, 5.7vw, 86px);
          line-height: 0.96;
          letter-spacing: -0.07em;
          font-weight: 950;
          text-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
        }

        .la-hero h1 span {
          display: block;
          color: #f3bd25;
          background: linear-gradient(135deg, #fef3c7 0%, #fbbf24 38%, #b45309 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .la-main-copy {
          margin: 0;
          font-size: 20px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.92);
          max-width: 640px;
        }

        .la-paper-card {
          margin-top: 22px;
          display: grid;
          grid-template-columns: 70px 1fr;
          gap: 16px;
          align-items: center;
          max-width: 585px;
          padding: 18px 20px;
          border-radius: 16px;
          border: 1px solid rgba(234, 179, 8, 0.38);
          background: linear-gradient(135deg, rgba(2, 6, 23, 0.82), rgba(15, 23, 42, 0.58));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 20px 50px rgba(0, 0, 0, 0.24);
          backdrop-filter: blur(10px);
        }

        .la-paper-icon {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          font-size: 34px;
          color: #facc15;
          filter: drop-shadow(0 0 10px rgba(234, 179, 8, 0.45));
        }

        .la-paper-card p {
          margin: 0;
          color: rgba(255, 255, 255, 0.88);
          line-height: 1.55;
          font-size: 15px;
        }

        .la-actions {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
          margin-top: 24px;
        }

        .la-btn {
          min-height: 54px;
          border-radius: 9px;
          padding: 0 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          text-decoration: none;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .la-btn:hover {
          transform: translateY(-2px);
        }

        .la-btn-primary {
          color: #111827;
          background: linear-gradient(135deg, #fde68a 0%, #fbbf24 45%, #d97706 100%);
          box-shadow: 0 18px 40px rgba(234, 179, 8, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.45);
        }

        .la-btn-secondary,
        .la-btn-dark {
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(2, 6, 23, 0.58);
        }

        .la-btn-blue {
          width: 100%;
          color: #ffffff;
          background: linear-gradient(135deg, #1d4ed8, #003b9e 55%, #021b4f);
          border: 1px solid rgba(96, 165, 250, 0.6);
          box-shadow: 0 16px 45px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.22);
          font-size: 20px;
        }

        .la-live-status {
          margin: 18px 0 0;
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.68);
        }

        .la-live-status span {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 16px rgba(34, 197, 94, 0.7);
        }

        .la-live-status strong {
          color: #22c55e;
        }

        .la-alert,
        .la-access-message {
          margin-top: 16px;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 700;
          max-width: 620px;
        }

        .la-alert-success {
          color: #bbf7d0;
          border: 1px solid rgba(34, 197, 94, 0.35);
          background: rgba(34, 197, 94, 0.12);
        }

        .la-alert-danger {
          color: #fecaca;
          border: 1px solid rgba(239, 68, 68, 0.35);
          background: rgba(239, 68, 68, 0.12);
        }

        .la-access-message {
          color: rgba(167, 243, 208, 0.98);
          background: rgba(2, 6, 23, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .la-hero-photo-wrap {
          position: relative;
          min-height: 520px;
          display: flex;
          justify-content: flex-end;
          align-items: flex-end;
        }

        .la-photo-halo {
          position: absolute;
          right: 10%;
          top: 8%;
          width: 470px;
          height: 470px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.36), rgba(2, 6, 23, 0) 68%);
          filter: blur(10px);
        }

        .la-hero-photo {
          position: relative;
          z-index: 1;
          width: min(520px, 92%);
          aspect-ratio: 1 / 1.1;
          object-fit: cover;
          object-position: center top;
          border-radius: 34px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow:
            0 30px 80px rgba(0, 0, 0, 0.62),
            0 0 90px rgba(37, 99, 235, 0.2);
          mask-image: linear-gradient(180deg, #000 0%, #000 78%, transparent 100%);
          -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 78%, transparent 100%);
        }

        .la-mentor-card {
          position: absolute;
          z-index: 3;
          right: 0;
          bottom: 35px;
          width: 280px;
          padding: 20px 22px;
          border-radius: 16px;
          border: 1px solid rgba(234, 179, 8, 0.35);
          background: rgba(2, 6, 23, 0.76);
          backdrop-filter: blur(12px);
          box-shadow: 0 20px 55px rgba(0, 0, 0, 0.42);
        }

        .la-mentor-card div {
          color: rgba(255, 255, 255, 0.9);
          font-size: 15px;
        }

        .la-mentor-card strong {
          display: block;
          margin: 4px 0 10px;
          font-size: 32px;
          line-height: 1;
          color: #fbbf24;
          font-family: 'Brush Script MT', 'Segoe Script', cursive;
          font-weight: 500;
        }

        .la-mentor-card ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 9px;
          color: rgba(255, 255, 255, 0.86);
          font-size: 14px;
        }

        .la-mentor-card li::before {
          content: '✓';
          color: #facc15;
          font-weight: 900;
          margin-right: 9px;
        }

        .la-strip {
          width: min(1500px, calc(100% - 64px));
          margin: -18px auto 26px;
          position: relative;
          z-index: 5;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(2, 6, 23, 0.92));
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.38);
          backdrop-filter: blur(12px);
        }

        .la-strip-item {
          min-height: 128px;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 18px 12px;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
        }

        .la-strip-item:last-child {
          border-right: 0;
        }

        .la-strip-icon {
          color: #facc15;
          font-size: 34px;
          margin-bottom: 8px;
          filter: drop-shadow(0 0 12px rgba(234, 179, 8, 0.45));
        }

        .la-strip-item strong,
        .la-strip-item span {
          display: block;
          color: rgba(255, 255, 255, 0.9);
        }

        .la-strip-item span {
          margin-top: 3px;
          color: rgba(255, 255, 255, 0.8);
        }

        .la-course {
          width: min(1500px, calc(100% - 64px));
          margin: 0 auto 24px;
          display: grid;
          grid-template-columns: 1.05fr 1fr 0.95fr;
          gap: 24px;
          align-items: stretch;
          padding: 28px;
          border-radius: 16px;
          border: 1px solid rgba(59, 130, 246, 0.48);
          background:
            linear-gradient(90deg, rgba(2, 6, 23, 0.96), rgba(15, 23, 42, 0.78), rgba(2, 6, 23, 0.96)),
            url('/trading-bg.jpg') center / cover no-repeat;
          box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.08), 0 24px 70px rgba(0, 0, 0, 0.36);
        }

        .la-course h2 {
          margin: 18px 0 18px;
          font-size: clamp(28px, 3vw, 42px);
          line-height: 1.05;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .la-course h2 span {
          color: #3b82f6;
        }

        .la-date-row {
          display: flex;
          gap: 14px;
          align-items: center;
          margin-bottom: 18px;
        }

        .la-date-icon {
          font-size: 34px;
          color: #facc15;
        }

        .la-date-row strong,
        .la-date-row span {
          display: block;
        }

        .la-date-row strong {
          font-size: 22px;
        }

        .la-date-row span {
          color: #facc15;
          font-weight: 900;
        }

        .la-course p {
          margin: 0;
          color: rgba(255, 255, 255, 0.82);
          line-height: 1.55;
          font-size: 17px;
        }

        .la-course-center {
          min-height: 230px;
          border-radius: 14px;
          overflow: hidden;
          opacity: 0.9;
          box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.6);
        }

        .la-course-center img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          filter: saturate(1.1) contrast(1.06);
        }

        .la-course-right {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 22px;
        }

        .la-course-right ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 14px;
          color: rgba(255, 255, 255, 0.9);
        }

        .la-course-right li::before,
        .la-plan-card li::before {
          content: '✓';
          color: #facc15;
          font-weight: 950;
          margin-right: 12px;
        }

        .la-plans {
          width: min(1500px, calc(100% - 64px));
          margin: 0 auto;
        }

        .la-section-title {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 18px 0 14px;
        }

        .la-section-title h2 {
          margin: 0;
          font-size: 24px;
          letter-spacing: -0.02em;
        }

        .la-section-title span {
          color: #facc15;
          border: 1px solid rgba(234, 179, 8, 0.35);
          background: rgba(234, 179, 8, 0.08);
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .la-plan-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .la-plan-card {
          position: relative;
          padding: 36px 38px 32px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(2, 6, 23, 0.93));
          min-height: 390px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .la-plan-featured {
          border-color: rgba(234, 179, 8, 0.88);
          box-shadow: 0 0 38px rgba(234, 179, 8, 0.34), inset 0 0 35px rgba(234, 179, 8, 0.07);
          transform: translateY(-2px);
        }

        .la-featured-badge {
          position: absolute;
          top: -16px;
          left: 50%;
          transform: translateX(-50%);
          padding: 8px 20px;
          border-radius: 999px;
          color: #111827;
          background: linear-gradient(135deg, #fde68a, #fbbf24, #d97706);
          font-size: 13px;
          font-weight: 950;
          box-shadow: 0 0 30px rgba(234, 179, 8, 0.42);
          white-space: nowrap;
        }

        .la-plan-card h3 {
          margin: 0;
          font-size: 30px;
          letter-spacing: -0.02em;
        }

        .la-plan-subtitle,
        .la-plan-note {
          margin: 2px 0 0;
          color: rgba(255, 255, 255, 0.72);
        }

        .la-plan-price {
          margin-top: 18px;
          font-size: 34px;
          font-weight: 950;
        }

        .la-plan-card ul {
          margin: 28px 0 26px;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 10px;
          text-align: left;
          width: 100%;
          color: rgba(255, 255, 255, 0.88);
        }

        .la-plan-card .la-btn {
          margin-top: auto;
          width: 100%;
        }

        .la-inside {
          width: min(1500px, calc(100% - 64px));
          margin: 44px auto 26px;
          text-align: center;
        }

        .la-inside h2 {
          margin: 0 0 18px;
          font-size: 24px;
          letter-spacing: -0.02em;
        }

        .la-inside-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 18px;
        }

        .la-inside-card {
          min-height: 190px;
          padding: 22px 14px;
          border-radius: 14px;
          border: 1px solid rgba(234, 179, 8, 0.28);
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(2, 6, 23, 0.94));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .la-inside-icon {
          height: 58px;
          display: grid;
          place-items: center;
          font-size: 38px;
          margin-bottom: 12px;
          filter: drop-shadow(0 0 16px rgba(59, 130, 246, 0.35));
        }

        .la-inside-card h3 {
          margin: 0 0 10px;
          font-size: 16px;
        }

        .la-inside-card p {
          margin: 0;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.4;
          font-size: 13px;
        }

        .la-stats {
          width: min(1500px, calc(100% - 64px));
          margin: 28px auto 22px;
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(2, 6, 23, 0.42);
          border-radius: 12px;
          overflow: hidden;
        }

        .la-stat {
          min-height: 102px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
        }

        .la-stat:last-child {
          border-right: 0;
        }

        .la-stat-icon {
          color: #facc15;
          font-size: 32px;
          font-weight: 950;
          filter: drop-shadow(0 0 14px rgba(234, 179, 8, 0.35));
        }

        .la-stat strong {
          font-size: 26px;
          line-height: 1;
        }

        .la-stat span {
          color: rgba(255, 255, 255, 0.72);
          line-height: 1.25;
        }

        .la-footer {
          text-align: center;
          padding: 12px 20px 40px;
          color: rgba(255, 255, 255, 0.58);
        }

        @media (max-width: 1180px) {
          .la-hero-content,
          .la-course {
            grid-template-columns: 1fr;
          }

          .la-hero-copy {
            max-width: 760px;
          }

          .la-hero-photo-wrap {
            min-height: 430px;
            justify-content: center;
          }

          .la-mentor-card {
            right: 8%;
          }

          .la-strip,
          .la-inside-grid,
          .la-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .la-plan-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .la-hero {
            padding: 38px 20px 16px;
          }

          .la-hero-content,
          .la-paper-card {
            grid-template-columns: 1fr;
          }

          .la-actions,
          .la-section-title {
            flex-direction: column;
            align-items: stretch;
          }

          .la-btn {
            width: 100%;
          }

          .la-strip,
          .la-course,
          .la-plans,
          .la-inside,
          .la-stats {
            width: calc(100% - 32px);
          }

          .la-strip,
          .la-inside-grid,
          .la-stats {
            grid-template-columns: 1fr;
          }

          .la-course {
            padding: 20px;
          }

          .la-mentor-card {
            left: 16px;
            right: 16px;
            width: auto;
          }
        }
      `}</style>
    </main>
  )
}
