import Link from 'next/link'
import { useRouter } from 'next/router'

const sections = [
  {
    title: '1. Información que recopilamos',
    body:
      'Lead Academy Corp Trading & Investing puede recopilar información proporcionada por el usuario, incluyendo nombre, correo electrónico, número telefónico, país, datos de acceso, preferencias de notificación, historial de compras, suscripciones, pagos y actividad dentro del portal.',
  },
  {
    title: '2. Uso de la información',
    body:
      'La información se utiliza para crear y administrar cuentas, habilitar el acceso al portal privado, procesar pagos, confirmar suscripciones, enviar avisos importantes, mejorar la experiencia del usuario y mantener la seguridad de la plataforma.',
  },
  {
    title: '3. Notificaciones SMS',
    body:
      'El usuario puede aceptar recibir notificaciones SMS relacionadas con verificación de cuenta, actividad de cuenta, actualizaciones de suscripción, confirmaciones de pago, recordatorios de operaciones en vivo, seminarios y alertas importantes. La autorización se realiza mediante una casilla de consentimiento no preseleccionada durante el registro o desde el portal del usuario.',
  },
  {
    title: '4. Consentimiento y cancelación de SMS',
    body:
      'El consentimiento para SMS queda registrado junto con el número telefónico y la fecha de autorización. Pueden aplicar tarifas de mensajes y datos. El usuario puede responder STOP para cancelar la recepción de mensajes SMS o HELP para recibir asistencia.',
  },
  {
    title: '5. Pagos y procesadores externos',
    body:
      'Los pagos pueden ser procesados por proveedores externos como Stripe u otros servicios autorizados. Lead Academy Corp Trading & Investing no almacena números completos de tarjetas de crédito en sus sistemas. Los datos de pago se gestionan conforme a las políticas del procesador correspondiente.',
  },
  {
    title: '6. Servicios de comunicación',
    body:
      'Para enviar notificaciones, verificaciones o comunicaciones importantes, la plataforma puede utilizar servicios externos como proveedores de correo electrónico, SMS, hosting, bases de datos, autenticación y herramientas operativas necesarias para el funcionamiento del portal.',
  },
  {
    title: '7. No venta de información personal',
    body:
      'Lead Academy Corp Trading & Investing no vende, alquila ni comparte información personal del usuario con terceros para fines de marketing externo. La información solo se comparte cuando es necesario para operar el servicio, cumplir obligaciones legales o proteger la seguridad de la plataforma.',
  },
  {
    title: '8. Seguridad de los datos',
    body:
      'Se utilizan medidas razonables de seguridad técnica y administrativa para proteger la información del usuario. Sin embargo, ningún sistema conectado a internet puede garantizar seguridad absoluta, por lo que el usuario también debe proteger sus credenciales de acceso.',
  },
  {
    title: '9. Acceso, actualización y eliminación',
    body:
      'El usuario puede solicitar actualización, corrección o eliminación de sus datos personales cuando corresponda. Algunas informaciones pueden conservarse por razones legales, contables, de seguridad, cumplimiento, historial de transacciones o prevención de fraude.',
  },
  {
    title: '10. Cookies y datos técnicos',
    body:
      'El portal puede utilizar cookies, almacenamiento local y datos técnicos del navegador para mantener sesiones, recordar preferencias, mejorar el rendimiento, proteger cuentas y analizar el funcionamiento general de la plataforma.',
  },
  {
    title: '11. Cambios a esta política',
    body:
      'Lead Academy Corp Trading & Investing puede actualizar esta política de privacidad cuando sea necesario. El uso continuo del portal después de una actualización implica la aceptación de la versión vigente.',
  },
]

export default function PrivacyPage() {
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

          <h1 style={{ marginBottom: 14 }}>Política de privacidad</h1>

          <p className="helper" style={{ marginBottom: 0 }}>
            Esta política explica cómo Lead Academy Corp Trading &amp; Investing recopila, utiliza y protege
            la información personal de los usuarios del portal privado.
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
            Lead Academy Corp Trading &amp; Investing no vende información personal del usuario a terceros.
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
              <Link href="/terms" className="btn btn-secondary">
                Términos y condiciones
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
            <strong>PRIVACIDAD</strong>
            <span>SMS • CUENTA • SUSCRIPCIONES • SEGURIDAD</span>
          </div>
        </div>
      </section>
    </main>
  )
}
