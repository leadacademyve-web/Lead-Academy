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
    <main className="auth-wrap auth-wrap-premium">
      <section className="auth-premium-card">
        <div className="auth-premium-form" style={{ paddingTop: 34, paddingBottom: 34 }}>
          <div className="auth-brand-block" style={{ marginBottom: 18 }}>
            <div
              style={{
                width: 92,
                height: 72,
                flex: '0 0 92px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src="/Logo.png"
                alt="Lead Academy"
                className="auth-logo-image"
                style={{
                  width: 150,
                  height: 150,
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
            <div>
              <div className="auth-brand-title">Lead Academy Corporation</div>
              <div className="auth-brand-sub">Trading &amp; Investing</div>
            </div>
          </div>

          <h1 style={{ marginBottom: 14 }}>Términos y condiciones</h1>

          <p className="helper" style={{ marginBottom: 0 }}>
            El uso de esta plataforma implica la aceptación total de estos términos. Si no estás de acuerdo,
            no debes utilizar este sitio ni adquirir acceso al portal privado.
          </p>

          <div
            style={{
              marginTop: 22,
              maxHeight: 430,
              overflowY: 'auto',
              paddingRight: 10,
              display: 'grid',
              gap: 12,
            }}
          >
            {sections.map((section) => (
              <section
                key={section.title}
                style={{
                  padding: '14px 16px',
                  borderRadius: 16,
                  background: 'rgba(3, 12, 27, 0.42)',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                }}
              >
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  {section.title}
                </div>
                <p className="helper" style={{ margin: 0, lineHeight: 1.68 }}>
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <div
            className="notice"
            style={{
              marginTop: 16,
              borderColor: 'rgba(234, 179, 8, 0.28)',
              background: 'rgba(234, 179, 8, 0.08)',
            }}
          >
            El contenido del portal es educativo. No constituye recomendación financiera ni promesa de resultados.
          </div>

          <div className="auth-premium-actions" style={{ marginTop: 16, gap: 10 }}>
            {returnTo ? (
              <Link href={returnTo} className="btn btn-primary auth-main-button" style={{ minHeight: 54 }}>
                Volver al pago
              </Link>
            ) : (
              <Link href="/" className="btn btn-primary auth-main-button" style={{ minHeight: 54 }}>
                Volver al inicio
              </Link>
            )}

            <div className="auth-secondary-row">
              <Link href="/privacy" className="btn btn-secondary">
                Política de privacidad
              </Link>
              <Link href="/signup" className="btn btn-ghost">
                Crear cuenta
              </Link>
            </div>
          </div>
        </div>

        <div className="auth-premium-image">
          <img src="/wall-street-bull.jpg" alt="Wall Street Bull" />
          <div className="auth-image-shade" />
          <div className="auth-image-overlay">
            <strong>DOCUMENTO LEGAL</strong>
            <span>TRADING • INVERSIONES • OPERACIONES EN VIVO</span>
          </div>
        </div>
      </section>
    </main>
  )
}
