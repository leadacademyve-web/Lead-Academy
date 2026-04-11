import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';

function getPlanSummary(title?: string | string[], price?: string | string[]) {
  const safeTitle = Array.isArray(title) ? title[0] : title || 'Plan seleccionado';
  const safePrice = Array.isArray(price) ? price[0] : price || '';
  const normalized = String(safeTitle).toUpperCase();

  const totalClasses =
    normalized.includes('20') ? 20 :
    normalized.includes('10') ? 10 :
    normalized.includes('5') ? 5 : null;

  return { safeTitle, safePrice, totalClasses };
}

export default function CheckoutConfirmPage() {
  const router = useRouter();
  const [purchaseType, setPurchaseType] = useState<'one_time' | 'subscription'>('one_time');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscriptionPriceKey = typeof router.query.subscriptionPriceKey === 'string' ? router.query.subscriptionPriceKey : '';
  const oneTimePriceKey = typeof router.query.oneTimePriceKey === 'string' ? router.query.oneTimePriceKey : '';
  const { safeTitle, safePrice, totalClasses } = useMemo(
    () => getPlanSummary(router.query.title, router.query.price),
    [router.query.title, router.query.price]
  );

  const selectedPriceKey = purchaseType === 'subscription' ? subscriptionPriceKey : oneTimePriceKey;

  async function handleContinue() {
    try {
      setLoading(true);
      setError(null);

      if (!acceptedTerms) {
        throw new Error('Debes aceptar los términos y condiciones para continuar.');
      }

      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user?.email) {
        router.push('/login?next=' + encodeURIComponent(router.asPath));
        return;
      }

      const res = await fetch('/api/stripe/live-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceKey: selectedPriceKey,
          userEmail: user.email,
          purchaseType,
          acceptedTerms: true,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'No se pudo iniciar el pago.');
      }

      if (!json?.url) {
        throw new Error('No se recibió la URL del checkout.');
      }

      window.location.href = json.url;
    } catch (e: any) {
      setError(e?.message || 'No se pudo iniciar el proceso de pago.');
      setLoading(false);
    }
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 780 }}>
        <h1>Confirmación antes del pago</h1>
        <p className="helper">
          Revisa tu selección, acepta los términos y continúa a Stripe para formalizar el pago.
        </p>

        <div
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 18,
            marginTop: 18,
            marginBottom: 18,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 10 }}>Resumen del plan</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>{safeTitle}</div>
          {safePrice ? <div style={{ fontSize: 18, marginBottom: 12 }}>{safePrice}</div> : null}
          {totalClasses ? (
            <div className="helper" style={{ lineHeight: 1.6 }}>
              Este pago agregará <strong>{totalClasses} clases</strong> a tu saldo disponible.
            </div>
          ) : null}
        </div>

        <label className="label">
          Tipo de compra
          <div style={{ display: 'grid', gap: 10 }}>
            <label
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: 14,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.08)',
                background: purchaseType === 'one_time' ? 'rgba(255,255,255,0.05)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                checked={purchaseType === 'one_time'}
                onChange={() => setPurchaseType('one_time')}
              />
              <div>
                <div style={{ fontWeight: 700 }}>Pago único</div>
                <div className="helper">
                  Harás un solo pago y las clases compradas se sumarán a tu saldo disponible.
                </div>
              </div>
            </label>

            <label
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: 14,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.08)',
                background: purchaseType === 'subscription' ? 'rgba(255,255,255,0.05)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                checked={purchaseType === 'subscription'}
                onChange={() => setPurchaseType('subscription')}
              />
              <div>
                <div style={{ fontWeight: 700 }}>Suscripción automática</div>
                <div className="helper">
                  Se harán cargos por suscripción según el plan que escojas.
                  
                </div>
              </div>
            </label>
          </div>
        </label>

        <div
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 18,
            marginTop: 18,
            marginBottom: 18,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 10 }}>Términos y condiciones</div>

          <div className="helper" style={{ lineHeight: 1.7 }}>
            Al continuar, aceptas que estás adquiriendo acceso a un portal educativo privado enfocado en trading e inversiones.<br /><br />

            Este servicio tiene fines exclusivamente educativos y no constituye asesoría financiera, legal o de inversión.<br /><br />

            Reconoces que el trading en mercados financieros implica riesgos significativos, incluyendo la posible pérdida total del capital, y que no existen garantías de resultados.<br /><br />

            Los pagos realizados son finales y no reembolsables. Al elegir suscripción, autorizas a Stripe a realizar recargos automáticos según la frecuencia del plan seleccionado, independientemente del uso o saldo de clases disponible.<br /><br />

            El acceso al portal depende de mantener clases disponibles o una suscripción activa.<br /><br />

            Todo el contenido del portal, incluyendo clases, estrategias y materiales, es propiedad de la plataforma y está estrictamente prohibido copiar, grabar, distribuir o enseñar este contenido sin autorización.<br /><br />

            Al continuar, aceptas estos términos y asumes total responsabilidad por tus decisiones y resultados.
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16 }}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            <span className="helper" style={{ lineHeight: 1.6 }}>
              Acepto los términos y condiciones, política de no reembolsos, recargos automáticos y uso personal del contenido.
            </span>
          </label>
        </div>

        <div style={{ fontSize: 12, opacity: 0.6, textAlign: 'center', marginBottom: 10 }}>
          🔒 Pago seguro procesado por Stripe
        </div>

        <div className="actions">
          <button className="btn btn-primary" onClick={handleContinue} disabled={loading}>
            {loading ? 'Abriendo pago...' : 'Continuar al pago'}
          </button>
          <Link href="/" className="btn btn-secondary">Volver al inicio</Link>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </div>
    </main>
  );
}
