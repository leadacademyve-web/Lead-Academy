import Link from 'next/link'
import { useRouter } from 'next/router'

export default function TermsPage() {
  const router = useRouter()
  const returnTo = typeof router.query.returnTo === 'string' ? router.query.returnTo : ''

  return (
    <main className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 900 }}>
        <h1>Términos y condiciones</h1>
        <p className="helper" style={{ lineHeight: 1.7 }}>
          El uso de esta plataforma implica la aceptación total de los siguientes términos.
          Si no estás de acuerdo con ellos, no debes utilizar este sitio ni adquirir acceso
          al portal privado.
        </p>

        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gap: 18,
            lineHeight: 1.75,
          }}
        >
          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>1. Naturaleza del servicio</div>
            <div className="helper">
              Lead Academy es una plataforma de educación en trading e inversiones. Todo el contenido
              ofrecido tiene fines exclusivamente educativos e informativos y no constituye asesoría
              financiera, legal, fiscal ni de inversión.
            </div>
          </section>

          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>2. Riesgo financiero</div>
            <div className="helper">
              El trading en mercados financieros implica riesgos significativos, incluyendo la posible
              pérdida total del capital invertido. No existen garantías de resultados, rendimiento o
              ganancias. Cada usuario es responsable de evaluar su situación financiera antes de tomar
              decisiones de inversión.
            </div>
          </section>

          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>3. Uso personal del acceso</div>
            <div className="helper">
              El acceso al portal es personal e intransferible. Está prohibido compartir cuentas, accesos,
              materiales, clases grabadas o cualquier contenido del portal con terceros sin autorización
              previa por escrito.
            </div>
          </section>

          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>4. Propiedad intelectual y confidencialidad</div>
            <div className="helper">
              Todo el contenido del portal, incluyendo clases, estrategias, metodologías, materiales,
              biblioteca, estructura del sistema y recursos educativos, es propiedad exclusiva de la
              plataforma. Está estrictamente prohibido copiar, grabar, distribuir, revender, reproducir,
              publicar o enseñar este contenido sin autorización. El usuario reconoce que el contenido y
              las estrategias compartidas son información propietaria y confidencial.
            </div>
          </section>

          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>5. Pagos y suscripciones</div>
            <div className="helper">
              Los pagos realizados agregan clases al saldo del usuario según el plan seleccionado.
              Si el usuario elige modalidad de suscripción, autoriza a Stripe a realizar recargos
              automáticos conforme a la frecuencia del plan contratado. Las renovaciones se procesan por
              calendario, independientemente del uso o saldo restante de clases.
            </div>
          </section>

          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>6. Política de reembolsos</div>
            <div className="helper">
              Todas las ventas son finales. No se realizan reembolsos, devoluciones ni créditos parciales
              por clases no utilizadas, acceso no aprovechado o cancelaciones voluntarias del usuario.
            </div>
          </section>

          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>7. Acceso y disponibilidad</div>
            <div className="helper">
              El acceso al portal depende de mantener clases disponibles o una suscripción activa según la
              lógica de la plataforma. Lead Academy podrá modificar, actualizar, suspender o reorganizar
              contenido, funcionalidades o accesos cuando sea necesario para la operación del servicio.
            </div>
          </section>

          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>8. Limitación de responsabilidad</div>
            <div className="helper">
              Lead Academy no se hace responsable por pérdidas financieras, decisiones de inversión,
              resultados individuales, interrupciones temporales del servicio o interpretaciones incorrectas
              del contenido por parte del usuario. Cada estudiante asume total responsabilidad por sus
              decisiones y resultados.
            </div>
          </section>

          <section>
            <div className="eyebrow" style={{ marginBottom: 8 }}>9. Aceptación</div>
            <div className="helper">
              Al registrarte, comprar un plan o utilizar esta plataforma, confirmas que has leído,
              entendido y aceptado estos términos y condiciones en su totalidad.
            </div>
          </section>
        </div>

        <div className="actions" style={{ marginTop: 24 }}>
          {returnTo ? (
            <Link href={returnTo} className="btn btn-primary">Volver al pago</Link>
          ) : (
            <Link href="/" className="btn btn-secondary">Volver al inicio</Link>
          )}
          <Link href="/login" className="btn btn-secondary">Iniciar sesión</Link>
        </div>
      </div>
    </main>
  )
}
