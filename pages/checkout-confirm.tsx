import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/src/lib/supabaseClient';

function getPlanSummary(title?: string | string[], price?: string | string[], classesOverride?: string | string[]) {
  const safeTitle = Array.isArray(title) ? title[0] : title || 'Plan seleccionado';
  const safePrice = Array.isArray(price) ? price[0] : price || '';
  const normalized = String(safeTitle).toUpperCase();

  const overrideRaw = Array.isArray(classesOverride) ? classesOverride[0] : classesOverride;
  const overrideValue = Number(overrideRaw);

  const totalClasses =
    Number.isFinite(overrideValue) && overrideValue > 0
      ? overrideValue
      : normalized.includes('20') ? 20 :
        normalized.includes('10') ? 10 :
        normalized.includes('5') ? 5 : null;

  return { safeTitle, safePrice, totalClasses };
}

export default function CheckoutConfirmPage() {
  const router = useRouter();
  const forcePurchaseType = typeof router.query.forcePurchaseType === 'string' && router.query.forcePurchaseType === 'subscription' ? 'subscription' : 'one_time';
  const hidePurchaseType = router.query.hidePurchaseType === '1';
  const [purchaseType, setPurchaseType] = useState<'one_time' | 'subscription'>(forcePurchaseType);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscriptionPriceKey = typeof router.query.subscriptionPriceKey === 'string' ? router.query.subscriptionPriceKey : '';
  const oneTimePriceKey = typeof router.query.oneTimePriceKey === 'string' ? router.query.oneTimePriceKey : '';
  const levelOverride = typeof router.query.levelOverride === 'string' ? router.query.levelOverride : '';
  const { safeTitle, safePrice, totalClasses } = useMemo(
    () => getPlanSummary(router.query.title, router.query.price, router.query.classesOverride),
    [router.query.title, router.query.price, router.query.classesOverride]
  );

  const selectedPriceKey = purchaseType === 'subscription' ? subscriptionPriceKey : oneTimePriceKey;
  const termsHref = `/terms?returnTo=${encodeURIComponent(router.asPath)}`;

  useEffect(() => {
    if (hidePurchaseType && purchaseType !== forcePurchaseType) {
      setPurchaseType(forcePurchaseType);
    }
  }, [hidePurchaseType, purchaseType, forcePurchaseType]);

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
          levelOverride: levelOverride || undefined,
          classesOverride: totalClasses || undefined,
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

  const isIntensiveSeminar =
    String(safeTitle || '').toLowerCase().includes('seminario') ||
    levelOverride === 'INTENSIVE_TWO_DAY';

  return (
    <main className="checkoutPage">
      <style jsx>{`
        .checkoutPage {
          min-height: 100vh;
          color: #fff;
          background:
            linear-gradient(120deg, rgba(1, 6, 18, 0.94), rgba(2, 12, 30, 0.78)),
            url("/trading-bg.jpg");
          background-size: cover;
          background-position: center;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          padding: 46px 34px 60px;
        }

        .checkoutShell {
          width: min(1280px, 100%);
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(480px, 0.95fr) minmax(420px, 0.75fr);
          gap: 34px;
          align-items: stretch;
        }

        .visualPanel,
        .confirmPanel {
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background:
            linear-gradient(180deg, rgba(7, 20, 45, 0.78), rgba(2, 8, 23, 0.86));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 28px 70px rgba(0, 0, 0, 0.38);
          overflow: hidden;
        }

        .visualPanel {
          position: relative;
          min-height: 720px;
          display: flex;
          align-items: flex-end;
          padding: 34px;
          background:
            linear-gradient(90deg, rgba(1, 7, 20, 0.55), rgba(1, 7, 20, 0.12), rgba(1, 7, 20, 0.84)),
            linear-gradient(180deg, rgba(1, 7, 20, 0.05), rgba(1, 7, 20, 0.9)),
            url("/trading-hero-final.jpg");
          background-size: cover;
          background-position: center center;
        }

        .visualPanel::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 52% 18%, rgba(0, 145, 255, 0.18), transparent 32%),
            radial-gradient(circle at 85% 54%, rgba(0, 145, 255, 0.13), transparent 26%);
          pointer-events: none;
        }

        .visualContent {
          position: relative;
          z-index: 2;
          max-width: 620px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(3, 12, 28, 0.68);
          color: #fff;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          backdrop-filter: blur(10px);
        }

        .redDot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #ff2c46;
          box-shadow: 0 0 18px rgba(255, 44, 70, 0.85);
        }

        .visualTitle {
          margin: 22px 0 16px;
          font-size: clamp(42px, 4.8vw, 68px);
          line-height: 0.96;
          letter-spacing: -0.06em;
          font-weight: 900;
        }

        .blue {
          color: #1499ff;
          text-shadow: 0 0 34px rgba(0, 145, 255, 0.36);
        }

        .visualText {
          max-width: 560px;
          color: rgba(255, 255, 255, 0.82);
          font-size: 17px;
          line-height: 1.55;
          margin: 0 0 24px;
        }

        .benefits {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 24px;
        }

        .benefit {
          padding: 13px 14px;
          border-radius: 16px;
          background: rgba(3, 12, 28, 0.58);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.88);
          font-size: 13px;
          font-weight: 800;
          backdrop-filter: blur(8px);
        }

        .confirmPanel {
          padding: 34px;
        }

        .topLine {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          margin-bottom: 24px;
        }

        .backLink {
          color: rgba(255, 255, 255, 0.72);
          text-decoration: none;
          font-weight: 800;
          font-size: 13px;
        }

        .secureBadge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(34, 255, 130, 0.1);
          border: 1px solid rgba(34, 255, 130, 0.24);
          color: #6cffad;
          font-size: 12px;
          font-weight: 900;
        }

        h1 {
          margin: 0;
          font-size: 34px;
          line-height: 1.05;
          letter-spacing: -0.045em;
        }

        .subtitle {
          margin: 14px 0 22px;
          color: rgba(255, 255, 255, 0.66);
          line-height: 1.55;
          font-size: 14px;
        }

        .summaryCard,
        .optionCard,
        .termsCard {
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background:
            linear-gradient(180deg, rgba(9, 25, 54, 0.76), rgba(4, 13, 31, 0.72));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          padding: 20px;
          margin: 16px 0;
        }

        .eyebrow {
          color: #f5b51b;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        .planName {
          font-size: 24px;
          font-weight: 900;
          line-height: 1.08;
          letter-spacing: -0.03em;
          margin-bottom: 10px;
        }

        .priceRow {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-top: 14px;
        }

        .price {
          color: #1499ff;
          font-size: 46px;
          font-weight: 900;
          letter-spacing: -0.04em;
          text-shadow: 0 0 30px rgba(0, 140, 255, 0.45);
        }

        .classesBadge {
          border-radius: 14px;
          padding: 10px 12px;
          background: rgba(0, 145, 255, 0.12);
          border: 1px solid rgba(0, 145, 255, 0.28);
          color: rgba(255, 255, 255, 0.88);
          font-size: 13px;
          font-weight: 800;
          text-align: right;
        }

        .purchaseGrid {
          display: grid;
          gap: 12px;
          margin-top: 8px;
        }

        .optionCard {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin: 0;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        .optionCard:hover {
          transform: translateY(-2px);
          border-color: rgba(0, 145, 255, 0.36);
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.22);
        }

        .optionCard.selected {
          border-color: rgba(0, 145, 255, 0.55);
          background:
            linear-gradient(180deg, rgba(0, 145, 255, 0.14), rgba(4, 13, 31, 0.72));
        }

        input[type="radio"],
        input[type="checkbox"] {
          accent-color: #1499ff;
          width: 17px;
          height: 17px;
          margin-top: 2px;
        }

        .optionTitle {
          font-weight: 900;
          margin-bottom: 5px;
        }

        .helper {
          color: rgba(255, 255, 255, 0.66);
          line-height: 1.58;
          font-size: 14px;
        }

        .termsScroll {
          max-height: 230px;
          overflow: auto;
          padding-right: 8px;
        }

        .termsScroll::-webkit-scrollbar {
          width: 7px;
        }

        .termsScroll::-webkit-scrollbar-thumb {
          background: rgba(0, 145, 255, 0.32);
          border-radius: 999px;
        }

        .acceptRow {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .acceptRow a {
          color: #8fd2ff;
        }

        .actions {
          display: flex;
          gap: 14px;
          align-items: center;
          margin-top: 18px;
        }

        .btnGhost {
          min-height: 52px;
          padding: 0 24px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #fff;
          font-weight: 900;
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(7, 15, 31, 0.62);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 10px 24px rgba(0, 0, 0, 0.18);
          backdrop-filter: blur(8px);
          cursor: pointer;
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease;
        }

        .btnGhost:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.36);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 14px 32px rgba(0, 0, 0, 0.3);
        }

        .btnGhost.primary {
          flex: 1;
          min-height: 58px;
          color: #fff;
          border-color: rgba(0, 145, 255, 0.42);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 0 30px rgba(0, 145, 255, 0.18),
            0 14px 32px rgba(0, 0, 0, 0.28);
        }

        .btnGhost:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .stripeNote {
          margin: 16px 0 4px;
          color: rgba(255, 255, 255, 0.56);
          text-align: center;
          font-size: 12px;
        }

        .error {
          margin-top: 14px;
          color: #fecaca;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.28);
          padding: 12px 14px;
          border-radius: 14px;
        }

        @media (max-width: 1050px) {
          .checkoutShell {
            grid-template-columns: 1fr;
          }

          .visualPanel {
            min-height: 520px;
          }
        }

        @media (max-width: 720px) {
          .checkoutPage {
            padding: 22px 14px 42px;
          }

          .visualPanel,
          .confirmPanel {
            border-radius: 22px;
          }

          .confirmPanel {
            padding: 22px;
          }

          .benefits {
            grid-template-columns: 1fr;
          }

          .actions {
            flex-direction: column;
            align-items: stretch;
          }

          .priceRow {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="checkoutShell">
        <section className="visualPanel">
          <div className="visualContent">
            <div className="pill">
              {isIntensiveSeminar ? "Seminario intensivo en vivo" : "Acceso al portal privado"}
              <span className="redDot" />
            </div>

            <h2 className="visualTitle">
              Confirma tu acceso <span className="blue">premium</span>
            </h2>

            <p className="visualText">
              Estás a un paso de formalizar tu inscripción y acceder a una experiencia
              privada de trading, operaciones en vivo, estrategias y contenido exclusivo.
            </p>

            <div className="benefits">
              <div className="benefit">✓ Pago seguro con Stripe</div>
              <div className="benefit">✓ Acceso privado al portal</div>
              <div className="benefit">✓ Operaciones en vivo</div>
              <div className="benefit">✓ Grabaciones y biblioteca</div>
            </div>
          </div>
        </section>

        <section className="confirmPanel">
          <div className="topLine">
            <Link href="/" className="backLink">← Volver al inicio</Link>
            <div className="secureBadge">🔒 Stripe seguro</div>
          </div>

          <h1>Confirmación antes del pago</h1>
          <p className="subtitle">
            Revisa tu selección, acepta los términos y continúa a Stripe para formalizar el pago.
          </p>

          <div className="summaryCard">
            <div className="eyebrow">Resumen del plan</div>
            <div className="planName">{safeTitle}</div>

            <div className="priceRow">
              {safePrice ? <div className="price">{safePrice}</div> : null}
              {totalClasses ? (
                <div className="classesBadge">
                  +{totalClasses} clases
                  <br />
                  disponibles
                </div>
              ) : null}
            </div>
          </div>

          {!hidePurchaseType ? (
            <div className="summaryCard">
              <div className="eyebrow">Tipo de compra</div>

              <div className="purchaseGrid">
                <label className={`optionCard ${purchaseType === 'one_time' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    checked={purchaseType === 'one_time'}
                    onChange={() => setPurchaseType('one_time')}
                  />
                  <div>
                    <div className="optionTitle">Pago único</div>
                    <div className="helper">
                      Harás un solo pago y las clases compradas se sumarán a tu saldo disponible.
                    </div>
                  </div>
                </label>

                <label className={`optionCard ${purchaseType === 'subscription' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    checked={purchaseType === 'subscription'}
                    onChange={() => setPurchaseType('subscription')}
                  />
                  <div>
                    <div className="optionTitle">Suscripción automática</div>
                    <div className="helper">
                      Las clases se sumarán a tu saldo y Stripe hará recargos automáticos usando la tarjeta registrada.
                      La renovación se procesará por calendario según el plan.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className="summaryCard">
              <div className="eyebrow">Tipo de compra</div>
              <div className="optionTitle">Pago único</div>
              <div className="helper">
                Harás un solo pago y se agregarán <strong>{totalClasses || 0} clases</strong> a tu saldo disponible.
              </div>
            </div>
          )}

          <div className="termsCard">
            <div className="eyebrow">Términos y condiciones</div>

            <div className="termsScroll helper">
              Al continuar, aceptas que estás adquiriendo acceso a un portal educativo privado enfocado en trading e inversiones.<br /><br />

              Este servicio tiene fines exclusivamente educativos y no constituye asesoría financiera, legal o de inversión.<br /><br />

              Reconoces que el trading en mercados financieros implica riesgos significativos, incluyendo la posible pérdida total del capital, y que no existen garantías de resultados.<br /><br />

              Los pagos realizados son finales y no reembolsables. Al elegir suscripción, autorizas a Stripe a realizar recargos automáticos según la frecuencia del plan seleccionado, independientemente del uso o saldo de clases disponible.<br /><br />

              El acceso al portal depende de mantener clases disponibles o una suscripción activa.<br /><br />

              Todo el contenido del portal, incluyendo clases, estrategias y materiales, es propiedad de la plataforma y está estrictamente prohibido copiar, grabar, distribuir o enseñar este contenido sin autorización.<br /><br />

              Al continuar, aceptas estos términos y asumes total responsabilidad por tus decisiones y resultados.
            </div>

            <label className="acceptRow">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span className="helper">
                Acepto los <Link href={termsHref}>términos y condiciones</Link>, política de no reembolsos,
                recargos automáticos y uso personal del contenido.
              </span>
            </label>
          </div>

          <div className="stripeNote">🔒 Pago seguro procesado por Stripe</div>

          <div className="actions">
            <button className="btnGhost primary" onClick={handleContinue} disabled={loading}>
              {loading ? 'Abriendo pago...' : 'Continuar al pago'}
            </button>
            <Link href="/" className="btnGhost">Volver</Link>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
