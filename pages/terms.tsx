import Link from 'next/link'
import { useRouter } from 'next/router'

const sections = [
  {
    title: '1. Naturaleza del servicio',
    body:
      'Lead Academy Corp Trading & Investing es una plataforma privada de educación en trading e inversiones. Todo el contenido ofrecido tiene fines exclusivamente educativos e informativos y no constituye asesoría financiera, legal, fiscal ni de inversión.',
  },
  {
    title: '2. Riesgo financiero',
    body:
      'El trading en mercados financieros implica riesgos significativos, incluyendo la posible pérdida total del capital invertido. No existen garantías de resultados, rendimiento o ganancias. Cada usuario es responsable de evaluar su situación financiera antes de tomar decisiones de inversión.',
  },
  {
    title: '3. Operaciones en vivo y seminarios',
    body:
      'Las sesiones en vivo, seminarios, ejemplos, análisis de mercado y estrategias compartidas dentro del portal tienen propósito educativo. Cualquier decisión de operar, comprar, vender o mantener instrumentos financieros es responsabilidad exclusiva del usuario.',
  },
  {
    title: '4. Uso personal del acceso',
    body:
      'El acceso al portal es personal e intransferible. Está prohibido compartir cuentas, accesos, materiales, grabaciones, biblioteca, chat, enlaces privados o cualquier contenido del portal con terceros sin autorización previa por escrito.',
  },
  {
    title: '5. Propiedad intelectual y confidencialidad',
    body:
      'Todo el contenido del portal, incluyendo clases, estrategias, metodologías, materiales, biblioteca, estructura del sistema, recursos educativos y transmisiones en vivo, es propiedad exclusiva de Lead Academy Corp Trading & Investing. Está estrictamente prohibido copiar, grabar, distribuir, revender, reproducir, publicar o enseñar este contenido sin autorización.',
  },
  {
    title: '6. Pagos y suscripciones',
    body:
      'Los pagos realizados otorgan acceso al portal, seminarios, operaciones en vivo o clases según el plan seleccionado. Si el usuario elige modalidad de suscripción, autoriza a Stripe u otro procesador autorizado a realizar cargos automáticos conforme a la frecuencia del plan contratado.',
  },
  {
    title: '7. Política de reembolsos',
    body:
      'Todas las ventas son finales, salvo que Lead Academy Corp Trading & Investing indique expresamente lo contrario por escrito. No se garantizan reembolsos, devoluciones ni créditos parciales por acceso no utilizado, cancelaciones voluntarias o resultados individuales del usuario.',
  },
  {
    title: '8. Notificaciones SMS',
    body:
      'El usuario puede aceptar recibir notificaciones SMS relacionadas con verificación de cuenta, actividad de cuenta, actualizaciones de suscripción, confirmaciones de pago, recordatorios de operaciones en vivo, seminarios y alertas importantes. Pueden aplicar tarifas de mensajes y datos. El usuario puede responder STOP para cancelar o HELP para recibir asistencia.',
  },
  {
    title: '9. Acceso y disponibilidad',
    body:
      'El acceso al portal depende de mantener una suscripción activa, clases disponibles o acceso vigente según la lógica de la plataforma. Lead Academy Corp Trading & Investing podrá modificar, actualizar, suspender o reorganizar contenido, funcionalidades o accesos cuando sea necesario para la operación del servicio.',
  },
  {
    title: '10. Limitación de responsabilidad',
    body:
      'Lead Academy Corp Trading & Investing no se hace responsable por pérdidas financieras, decisiones de inversión, resultados individuales, interrupciones temporales del servicio o interpretaciones incorrectas del contenido por parte del usuario. Cada usuario asume total responsabilidad por sus decisiones y resultados.',
  },
  {
    title: '11. Aceptación',
    body:
      'Al registrarte, comprar un plan, participar en un seminario o utilizar esta plataforma, confirmas que has leído, entendido y aceptado estos términos y condiciones en su totalidad.',
  },
]

export default function TermsPage() {
  const router = useRouter()
  const returnTo = typeof router.query.returnTo === 'string' ? router.query.returnTo : ''

  return (
    <main
      className="auth-wrap"
      style={{
        minHeight: '100vh',
        padding: '54px 18px',
        background:
          'radial-gradient(circle at 18% 12%, rgba(0, 149, 255, 0.18), transparent 32%), radial-gradient(circle at 88% 18%, rgba(255, 184, 0, 0.12), transparent 26%), linear-gradient(135deg, #06101f 0%, #0b1629 46%, #040812 100%)',
      }}
    >
      <section
        style={{
          width: 'min(1120px, 100%)',
          margin: '0 auto',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 28,
          overflow: 'hidden',
          background: 'rgba(7, 16, 31, 0.82)',
          boxShadow: '0 26px 80px rgba(0,0,0,0.38)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.2fr)',
            minHeight: 640,
          }}
        >
          <aside
            style={{
              position: 'relative',
              padding: '44px 38px',
              background:
                'linear-gradient(180deg, rgba(12, 31, 61, 0.95), rgba(4, 10, 20, 0.92))',
              borderRight: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 38 }}>
              <img
                src="/Logo.png"
                alt="Lead Academy"
                style={{ width: 72, height: 72, objectFit: 'contain' }}
              />
              <div>
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 900, lineHeight: 1.05 }}>
                  Lead Academy Corp
                </div>
                <div style={{ color: '#f5b900', fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>
                  TRADING & INVESTING
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                border: '1px solid rgba(0, 174, 255, 0.35)',
                borderRadius: 999,
                color: '#7dd3fc',
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 18,
              }}
            >
              Documento legal
            </div>

            <h1
              style={{
                margin: 0,
                color: '#fff',
                fontSize: 46,
                lineHeight: 1,
                letterSpacing: '-1.8px',
              }}
            >
              Términos y condiciones
            </h1>

            <p style={{ color: '#cbd5e1', fontSize: 16, lineHeight: 1.7, marginTop: 22 }}>
              El uso de esta plataforma implica la aceptación total de los siguientes términos. Si no estás
              de acuerdo con ellos, no debes utilizar este sitio ni adquirir acceso al portal privado.
            </p>

            <div
              style={{
                marginTop: 28,
                padding: 18,
                borderRadius: 20,
                background: 'rgba(255, 184, 0, 0.1)',
                border: '1px solid rgba(255, 184, 0, 0.28)',
              }}
            >
              <div style={{ color: '#f5b900', fontWeight: 900, marginBottom: 8 }}>Importante</div>
              <div style={{ color: '#dbeafe', fontSize: 14, lineHeight: 1.6 }}>
                El contenido del portal es educativo. No constituye recomendación financiera ni promesa de
                resultados.
              </div>
            </div>
          </aside>

          <div style={{ padding: '44px 42px', background: 'rgba(2, 8, 23, 0.55)' }}>
            <div style={{ display: 'grid', gap: 16 }}>
              {sections.map((section) => (
                <section
                  key={section.title}
                  style={{
                    padding: '18px 20px',
                    borderRadius: 18,
                    background: 'rgba(15, 23, 42, 0.68)',
                    border: '1px solid rgba(148, 163, 184, 0.16)',
                  }}
                >
                  <div
                    style={{
                      color: '#f5b900',
                      fontSize: 13,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      marginBottom: 8,
                    }}
                  >
                    {section.title}
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.72 }}>{section.body}</div>
                </section>
              ))}
            </div>

            <div
              className="actions"
              style={{
                marginTop: 26,
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              {returnTo ? (
                <Link href={returnTo} className="btn btn-primary">
                  Volver al pago
                </Link>
              ) : (
                <Link href="/" className="btn btn-primary">
                  Volver al inicio
                </Link>
              )}

              <Link href="/privacy" className="btn btn-secondary">
                Ver política de privacidad
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
