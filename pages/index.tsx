import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuthUser } from '@/src/context/AuthUserProvider'
import { getLiveAccessByEmail } from '@/src/lib/liveAccess'

const plans = [
  {
    id: 'week',
    title: '5 clases - Operaciones en vivo',
    price: 'US$99',
    note: 'Renovación semanal si eliges suscripción',
    priceKey: 'NEXT_PUBLIC_STRIPE_PRICE_WEEKLY',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_WEEKLY_ONE_TIME',
    bullets: [
      { text: 'Acceso a la clase en vivo y repeticiones', available: true },
      { text: 'Acceso a la biblioteca de instrucciones', available: false },
      { text: 'Acceso completo al portal y a las estrategias', available: false },
    ],
  },
  {
    id: 'two-weeks',
    title: '10 clases - Operaciones en vivo',
    price: 'US$189',
    note: 'Renovación quincenal si eliges suscripción',
    priceKey: 'NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS_ONE_TIME',
    bullets: [
      { text: 'Acceso a la clase en vivo y repeticiones', available: true },
      { text: 'Acceso a la biblioteca de instrucciones', available: true },
      { text: 'Acceso completo al portal y a las estrategias', available: false },
     ],
  },
  {
    id: 'month',
    title: '20 clases - Operaciones en vivo',
    price: 'US$369',
    note: 'Renovación mensual si eliges suscripción',
    priceKey: 'NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS',
    oneTimePriceKey: 'NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS_ONE_TIME',
    bullets: [
      { text: 'Acceso a la clase en vivo y repeticiones', available: true },
      { text: 'Acceso a la biblioteca de instrucciones', available: true },
      { text: 'Acceso completo al portal y a las estrategias', available: true },
    ],
  },
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

  return (
    <main style={{ background: 'url("/trading-bg.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', minHeight: '100vh', color: 'white', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 25,
          left: '60%',
          transform: 'translateX(40%)',
          width: 355,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >

{/* Earnings Report Banner independiente */}
<div
  style={{
    position: 'absolute',

    // 📍 posición inicial (ajústala luego)
    bottom: -500,
    right: 160,

    width: 380,
    zIndex: 2,

    // 🎛️ márgenes ajustables
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
  }}
>
  <img
    src="/Earning Reports BOA-NFLX.jpg"
    alt="Earning Reports BOA NFLX"
    style={{
      width: '191%',
      borderRadius: 20,
      height: 'auto',
      display: 'block',
      objectFit: 'contain',
      pointerEvents: 'none',
    }}
  />
</div>
        <img
          src="/curso-intensivo-online.jpg"
          alt="Curso intensivo online"
          style={{
            width: '204%',
            borderRadius: 20,
            height: 'auto',
            display: 'block',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />

        <Link
          href={
            user
              ? `/checkout-confirm?oneTimePriceKey=${encodeURIComponent('NEXT_PUBLIC_STRIPE_PRICE_INTENSIVE_ONE_TIME')}&title=${encodeURIComponent('Curso intensivo online en vivo - 5 clases')}&price=${encodeURIComponent('US$500')}&forcePurchaseType=one_time&hidePurchaseType=1&classesOverride=5&levelOverride=${encodeURIComponent('INTENSIVE_TWO_DAY')}`
              : '/signup'
          }
          className="btn btn-primary"
          style={{
            marginTop: 18,
            minWidth: 220,
            position: 'relative',
            left: '-38%',
            transform: 'translateX(-50%)',
            zIndex: 3,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Inscribirme US$500
        </Link>
      </div>

      <section style={{ padding: '25px', display: 'flex', justifyContent: 'left' }}>
        <div style={{
          maxWidth: 1000,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 30,
          background: 'rgba(2,6,23,0.9)', backdropFilter: 'blur(6px)',
          borderRadius: 20,
          padding: 30,
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div>
            <h1 style={{ fontSize: 48, lineHeight: 1.1 }}>
             Lead Academy <br />
Trading & Investing
            </h1>

            {paid && (
              <div
                style={{
                  background: 'rgba(34,197,94,0.15)',
                  border: '1px solid rgba(34,197,94,0.30)',
                  padding: '12px 16px',
                  borderRadius: 12,
                  marginTop: 18,
                  color: 'rgba(134,239,172,0.98)',
                  fontWeight: 600,
                }}
              >
                ✅ Pago procesado correctamente. Tu acceso al portal se activará el día del curso intensivo.
              </div>
            )}

            {canceled && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.30)',
                  padding: '12px 16px',
                  borderRadius: 12,
                  marginTop: 18,
                  color: 'rgba(252,165,165,0.98)',
                  fontWeight: 600,
                }}
              >
                ❌ El pago fue cancelado. Puedes intentarlo nuevamente cuando lo desees.
              </div>
            )}

            <p style={{ marginTop: 20, opacity: 0.7 }}>
              Portal privado de trading e inversiones en la bolsa de New York. Crea tu usuario, inicia sesión y activa tu suscripción para acceder a la clase en vivo y a las repeticiones disponibles.
            </p>


            <div style={{ marginTop: 30, display: 'flex', gap: 15 }}>
              <Link href={user ? '/dashboard' : '/signup'} className="btn btn-primary">
                {user ? 'Ir al portal' : 'Crear cuenta'}
              </Link>

              <Link href="/login" className="btn btn-secondary">
                Iniciar sesión
              </Link>
            </div>

            <p
              style={{
                marginTop: 20,
                fontSize: 14,
                opacity: 0.92,
                color:
                  accessActive
                    ? 'rgba(134,239,172,0.98)'
                    : accessPlan === 'INTENSIVE_TWO_DAY' && classesRemaining !== null && classesRemaining > 0
                      ? 'rgba(253,224,71,0.98)'
                      : classesRemaining === 0
                        ? 'rgba(252,165,165,0.98)'
                        : 'rgba(255,255,255,0.72)',
              }}
            >
              {accessMessage}
            </p>
          </div>

          <div style={{
            background: 'rgba(2,6,23,0)', backdropFilter: 'blur(6px)',
            padding: 20,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <h3>¿Cómo funciona?</h3>

            <p style={{ marginTop: 10, opacity: 0.7, lineHeight: 1.8 }}>
              1. Crea tu cuenta, confirma correo electrónico e inicia sesión.<br />
              2. Selecciona el plan de acceso que prefieras y agrega clases a tu saldo.<br />
              3. Antes de pagar deberás aceptar los términos y condiciones.<br />
              4. Si eliges suscripción, los cargos serán según la frecuencia calendario que escojas.
            </p>

            <button
              className="btn btn-secondary"
              style={{ marginTop: 0, width: '100%' }}
              onClick={() => router.push('/dashboard')}
            >
              Ir al portal
            </button>
          </div>
        </div>
      </section>

      <section style={{ padding: '1px' }}>
<h2 style={{ textAlign: 'left', marginTop: -10, marginBottom: 15, paddingLeft: 25 }}>
  Elige un plan de pago.
</h2>

<div style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(3,1fr)',
  gap: 20,
  maxWidth: 1000,
  margin: '0',
  marginLeft: 25
}}>
          {plans.map((plan) => (
            <div key={plan.id} style={{
              background: 'rgba(2,6,23,0.80)', backdropFilter: 'blur(6px)',
              padding: 40,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <h3>{plan.title}</h3>
              <div style={{ fontSize: 25, fontWeight: 600 }}>{plan.price}</div>
              <div style={{ opacity: 0.6 }}>{plan.note}</div>

              <ul style={{ marginTop: 25, paddingLeft: 14, display: 'grid', gap: 15, lineHeight: 1.0 }}>
                {plan.bullets.map((bullet) => (
                  <li
                    key={bullet.text}
                    style={{
                      color: bullet.available ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.42)',
                      textDecoration: bullet.available ? 'none' : 'line-through',
                      textDecorationThickness: bullet.available ? undefined : '2px',
                    }}
                  >
                    {bullet.text}
                  </li>
                ))}
              </ul>

              <Link
                href={
                  user
                    ? `/checkout-confirm?subscriptionPriceKey=${encodeURIComponent(plan.priceKey)}&oneTimePriceKey=${encodeURIComponent(plan.oneTimePriceKey)}&title=${encodeURIComponent(plan.title)}&price=${encodeURIComponent(plan.price)}`
                    : '/signup'
                }
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 50 }}
              >
                Comprar este plan
              </Link>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, opacity: 0.6 }}>
          Soporte: Escríbenos a Leadacademyve@gmail.com · WhatsApp: +1 786 620 4377
        </div>
      </section>
    </main>
  )
}
