import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuthUser } from '@/src/context/AuthUserProvider'

const plans = [
  {
    id: 'week',
    title: '1 Semana',
    price: '$99',
    note: 'Suscripción semanal',
    bullets: [
      'Acceso al portal privado',
      'Acceso a la clase en vivo',
      'Grabaciones disponibles por 7 dias',
    ],
  },
  {
    id: 'two-weeks',
    title: '2 Semanas',
    price: '$189',
    note: 'Suscripción de dos semanas',
    bullets: [
      'Acceso al portal privado',
      'Acceso a la clase en vivo',
      'Mejor relación costo / acceso',
    ],
  },
  {
    id: 'month',
    title: '4 Semanas',
    price: '$369',
    note: 'Suscripción de cuatro semanas',
    bullets: [
      'Acceso al portal privado',
      'Acceso a la clase en vivo',
      'Consolida tu plan y estrategia',
    ],
  },
]

export default function HomePage() {
  const router = useRouter()
  const { user } = useAuthUser()

  return (
    <main style={{ background: 'url("/trading-bg.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', minHeight: '100vh', color: 'white' }}>
      <section style={{ padding: '0px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          maxWidth: 1100,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 30,
          background: 'rgba(2,6,23,0.65)', backdropFilter: 'blur(6px)',
          borderRadius: 20,
          padding: 10,
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div>
            <h1 style={{ fontSize: 48, lineHeight: 1.1 }}>
             Lead Academy - Trading & Investing
            </h1>

            <p style={{ marginTop: 20, opacity: 0.7 }}>
              Portal privado de trading e inversiones en la bolsa de New York. Crea tu usuario, inicia sesión y activa tu suscripción para acceder a la clase en vivo y a las repeticiones disponibles.
            </p>


            <div style={{ marginTop: 30, display: 'flex', gap: 15 }}>
              <Link href={user ? '/dashboard' : '/signup'} className="btn btn-primary">
                Entrar a la clase en vivo
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
              1. Crea tu cuenta o inicia sesión.<br />
              2. Selecciona el plan de acceso que prefieras.<br />
              3. Activa tu suscripción de preferencia.<br />
              4. Entra al dashboard y mira la clase en vivo o las repeticiones disponibles.
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
          maxWidth: 1100,
          margin: '0 auto'
        }}>
          {plans.map((plan) => (
            <div key={plan.id} style={{
              background: 'rgba(2,6,23,0.65)', backdropFilter: 'blur(6px)',
              padding: 25,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <h3>{plan.title}</h3>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{plan.price}</div>
              <div style={{ opacity: 0.6 }}>{plan.note}</div>

              <ul style={{ marginTop: 15 }}>
                {plan.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>

              <Link
                href={user ? '/dashboard' : '/signup'}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 20 }}
              >
                Entrar a la clase en vivo
              </Link>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, opacity: 0.6 }}>
          Soporte: Leadacademyve@gmail.com · WhatsApp: +1 786 557 1816
        </div>
      </section>
    </main>
  )
}
