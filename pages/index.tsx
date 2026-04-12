import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuthUser } from '@/src/context/AuthUserProvider'

const plans = [
  {
    id: 'week',
    title: '5 clases',
    price: '$99',
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
    title: '10 clases',
    price: '$189',
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
    title: '20 clases',
    price: '$369',
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
  const [showRecoveryOverlay, setShowRecoveryOverlay] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    if (!router.query.portalRecovery) return

    setShowRecoveryOverlay(true)

    const timeout = window.setTimeout(() => {
      router.replace('/dashboard?portalRecovered=1')
    }, 5000)

    return () => window.clearTimeout(timeout)
  }, [router])

  return (
    <main style={{ background: 'url("/trading-bg.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', minHeight: '100vh', color: 'white', position: 'relative', overflow: 'hidden' }}>
      {showRecoveryOverlay ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(2,6,23,0.96)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 14,
            textAlign: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.18)',
              borderTopColor: 'rgba(255,255,255,0.92)',
              animation: 'lead-spin 1s linear infinite',
            }}
          />
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0.2 }}>
            Cargando transmisión...
          </div>
          <div style={{ fontSize: 14, opacity: 0.72, maxWidth: 520 }}>
            Estamos restaurando el portal para que la clase vuelva a mostrarse limpia.
          </div>
          <style jsx>{`
            @keyframes lead-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : null}
      <section style={{ padding: '100px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          maxWidth: 1500,
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

            <p style={{ marginTop: 20, fontSize: 14, opacity: 0.6 }}>
              El acceso a clases en vivo se habilita únicamente para estudiantes con suscripción activa.
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
              style={{ marginTop: 20, width: '100%' }}
              onClick={() => router.push('/dashboard')}
            >
              Ir al portal
            </button>
          </div>
        </div>
      </section>

      <section style={{ padding: '1px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 15 }}>
          Elige tu acceso al portal privado
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,1fr)',
          gap: 20,
          maxWidth: 1500,
          margin: '0 auto'
        }}>
          {plans.map((plan) => (
            <div key={plan.id} style={{
              background: 'rgba(2,6,23,0.80)', backdropFilter: 'blur(6px)',
              padding: 40,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <h3>{plan.title}</h3>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{plan.price}</div>
              <div style={{ opacity: 0.6 }}>{plan.note}</div>

              <ul style={{ marginTop: 25, paddingLeft: 24, display: 'grid', gap: 14, lineHeight: 1.45 }}>
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
                style={{ width: '100%', marginTop: 24 }}
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
