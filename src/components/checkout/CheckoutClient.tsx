"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FormProvider, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, LockKeyhole } from "lucide-react";
import { confirmPaymentAction, getCheckoutQuoteAction, placeOrderAction } from "@/actions/checkout/checkout";
import type { PaymentOutcome } from "@/actions/checkout/checkout.schema";
import { applyServerFieldErrors, errorCode } from "@/components/account/forms/form-utils";
import { localize } from "@/lib/i18n-string";
import type { CountryOption } from "@/components/account/forms/regions";
import { Alert, Button, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ActionResult } from "@/lib/action-result";
import { useErrorText } from "@/lib/hooks/use-error-text";
import { formatMoney, type CurrencyContext } from "@/lib/money";
import type { CheckoutQuote } from "@/lib/services/contracts";
import type { Address, CartView } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { digitsOnly, parseExpiry } from "./form/card-utils";
import { clearCheckoutKey, getCheckoutKey } from "./form/checkout-key";
import { addressToFormValues, createCheckoutSchema, EMPTY_ADDRESS, mapServerFieldToForm, toAddressInput, type CheckoutFormValues } from "./form/checkout-form";
import { BillingSection } from "./sections/BillingSection";
import { OrderSummaryPanel, type SummaryTotals } from "./sections/OrderSummaryPanel";
import { PaymentSection } from "./sections/PaymentSection";
import { StepStrip, type Step } from "./sections/StepStrip";
import { ShippingAddressSection } from "./sections/ShippingAddressSection";
import { ShippingMethodSection } from "./sections/ShippingMethodSection";
import { ThreeDSecureModal } from "./sections/ThreeDSecureModal";

export interface CheckoutClientProps {
  cart: CartView;
  initialQuote: CheckoutQuote | null;
  currency: CurrencyContext;
  countries: CountryOption[];
  defaultCountry: string;
  user: { name: string; email: string; phone: string } | null;
  savedAddresses: Address[];
  showTestCards: boolean;
}

/** Errors that mean "this card / payment attempt failed" and belong next to the card fields. */
const PAYMENT_ERRORS = new Set(["payment_declined", "payment_insufficient_funds", "payment_expired_card", "payment_failed", "payment_authentication_failed", "payment_requires_action"]);
/** Errors that mean the cart changed under the customer: re-quote and tell them. */
const CART_ERRORS = new Set(["price_changed", "out_of_stock", "insufficient_stock", "variant_unavailable", "product_unavailable", "cart_empty", "coupon_invalid", "coupon_expired", "coupon_used_up", "coupon_min_subtotal", "coupon_not_applicable"]);

interface ChallengeState {
  orderNumber: string;
  accessToken: string;
  actionToken: string;
}

function Section({ step, title, children, id }: { step: number; title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24">
      <div className="mb-5 flex items-baseline gap-3 border-b-2 border-foreground pb-2">
        <span aria-hidden className="mono text-[0.9375rem] font-semibold text-primary-text">
          {String(step).padStart(2, "0")}
        </span>
        <h2 id={id} className="display-3">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function CheckoutClient({ cart, initialQuote, currency, countries, defaultCountry, user, savedAddresses, showTestCards }: CheckoutClientProps) {
  const t = useTranslations("checkout");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { validation, actionError } = useErrorText();
  const isGuest = user === null;

  /* ---------------------------------------------------------------- form */

  const defaultSaved = savedAddresses.find((a) => a.isDefaultShipping) ?? savedAddresses[0];
  const [firstName = "", ...rest] = (user?.name ?? "").split(/\s+/);
  const defaultValues = useMemo<CheckoutFormValues>(
    () => ({
      email: user?.email ?? "",
      newsletterOptIn: false,
      savedAddressId: defaultSaved?.id ?? "",
      saveAddress: false,
      shipping: defaultSaved ? addressToFormValues(defaultSaved) : { ...EMPTY_ADDRESS, firstName, lastName: rest.join(" "), phone: user?.phone ?? "", country: defaultCountry },
      billingSameAsShipping: true,
      billing: { ...EMPTY_ADDRESS, country: defaultCountry },
      shippingMethodId: initialQuote?.shippingQuotes[0]?.methodId ?? "",
      card: { number: "", expiry: "", cvc: "", holder: user?.name ?? "" },
      customerNote: "",
      acceptTerms: false,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const schema = useMemo(() => createCheckoutSchema(isGuest), [isGuest]);
  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<CheckoutFormValues>,
    defaultValues,
    mode: "onTouched",
  });
  const { control, register, handleSubmit, setValue, setFocus, formState } = form;
  const err = (name: string) => {
    const code = errorCode(formState.errors, name);
    return code ? validation(code) : undefined;
  };

  /* ---------------------------------------------------------------- quote */

  const [quote, setQuote] = useState<CheckoutQuote | null>(initialQuote);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const sequence = useRef(0);

  const country = useWatch({ control, name: "shipping.country" });
  const region = useWatch({ control, name: "shipping.region" });
  const methodId = useWatch({ control, name: "shippingMethodId" });
  const emailValue = useWatch({ control, name: "email" });
  const shipLine1 = useWatch({ control, name: "shipping.line1" });
  const shipCity = useWatch({ control, name: "shipping.city" });
  const cardNumber = useWatch({ control, name: "card.number" });

  useEffect(() => {
    if (!country) return;
    const mine = ++sequence.current;
    const timer = setTimeout(async () => {
      setQuoting(true);
      const result = await getCheckoutQuoteAction({ country, region: region ?? "", shippingMethodId: methodId || undefined, locale });
      if (mine !== sequence.current) return;
      setQuoting(false);
      if (result.ok) {
        setQuote(result.data);
        setQuoteError(null);
        const ids = result.data.shippingQuotes.map((q) => q.methodId);
        if (!ids.includes(methodId)) setValue("shippingMethodId", ids[0] ?? "", { shouldDirty: true });
      } else {
        setQuoteError(actionError(result, currency));
        if (result.error === "cart_empty") router.refresh();
      }
    }, 200);
    return () => clearTimeout(timer);
    // actionError / router / setValue are stable enough; re-quote only when the inputs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, region, methodId, refreshKey, locale]);

  const requote = useCallback(() => setRefreshKey((n) => n + 1), []);

  const totals: SummaryTotals = quote?.totals ?? { subtotal: cart.totals.subtotal, discount: cart.totals.discount, shipping: 0, tax: 0, total: cart.totals.subtotal - cart.totals.discount };
  const lines = quote?.cart.lines ?? cart.lines;
  const couponCode = quote ? quote.cart.coupon?.code : cart.coupon?.code;
  const shippingChosen = Boolean(quote?.selectedShipping);
  const summaryProps = {
    lines,
    totals,
    shippingChosen,
    locale,
    currency,
    loading: quoting,
    onCouponChanged: requote,
    ...(couponCode ? { couponCode } : {}),
    ...(quote?.taxRate ? { taxName: quote.taxRate.name, taxRateBps: quote.taxRate.rateBps } : {}),
    ...(quote ? { charge: { amount: quote.charge.amount, currency: quote.charge.currency } } : {}),
  };
  const chargeLabel = quote ? formatMoney(totals.total, locale, currency) : "";

  /* ---------------------------------------------------------------- submit */

  const fingerprint = useMemo(() => `${cart.id}:${cart.lines.map((l) => `${l.variantId}x${l.quantity}`).join(",")}`, [cart]);
  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const idempotencyKey = () => {
    if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) keyRef.current = { fingerprint, key: getCheckoutKey(fingerprint) };
    return keyRef.current.key;
  };

  const submitting = useRef(false);
  const redirecting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [challengeBusy, setChallengeBusy] = useState<"approve" | "decline" | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paymentError) document.getElementById("payment-error")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [paymentError]);
  useEffect(() => {
    if (formError) bannerRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [formError]);

  function finish(outcome: PaymentOutcome) {
    redirecting.current = true;
    clearCheckoutKey();
    keyRef.current = null;
    router.push(`/checkout/confirmation/${encodeURIComponent(outcome.orderNumber)}?t=${encodeURIComponent(outcome.accessToken)}`);
  }

  function handleFailure(result: Extract<ActionResult<PaymentOutcome>, { ok: false }>) {
    const unmapped = applyServerFieldErrors(form, result.fieldErrors, mapServerFieldToForm);
    if (PAYMENT_ERRORS.has(result.error)) {
      setPaymentError(actionError(result, currency));
      setValue("card.cvc", "", { shouldDirty: true });
      setFocus("card.number");
      return;
    }
    if (CART_ERRORS.has(result.error)) {
      requote();
      router.refresh();
    }
    if (unmapped.length > 0 || !result.fieldErrors || CART_ERRORS.has(result.error)) setFormError(actionError(result, currency));
  }

  const submitValid = async (values: CheckoutFormValues) => {
      if (submitting.current || !quote?.selectedShipping) return;
      submitting.current = true;
      setBusy(true);
      setFormError(null);
      setPaymentError(null);
      try {
        const expiry = parseExpiry(values.card.expiry);
        const result = await placeOrderAction({
          ...(isGuest ? { email: values.email } : {}),
          locale,
          shippingAddress: toAddressInput(values.shipping),
          ...(values.billingSameAsShipping ? {} : { billingAddress: toAddressInput(values.billing) }),
          shippingMethodId: values.shippingMethodId,
          customerNote: values.customerNote.trim() || undefined,
          newsletterOptIn: values.newsletterOptIn,
          saveAddress: !isGuest && values.savedAddressId === "" && values.saveAddress,
          acceptTerms: values.acceptTerms,
          idempotencyKey: idempotencyKey(),
          expectedTotal: quote.totals.total,
          payment: {
            type: "card",
            card: { number: digitsOnly(values.card.number), expMonth: expiry?.month ?? 0, expYear: expiry?.year ?? 0, cvc: values.card.cvc, holder: values.card.holder.trim() },
          },
        });
        if (!result.ok) {
          handleFailure(result);
          return;
        }
        if (result.data.status === "succeeded") {
          finish(result.data);
          return;
        }
        setChallenge({ orderNumber: result.data.orderNumber, accessToken: result.data.accessToken, actionToken: result.data.actionToken ?? "" });
      } finally {
        submitting.current = redirecting.current;
        if (!redirecting.current) setBusy(false);
      }
  };
  const onSubmit = (event: FormEvent<HTMLFormElement>) => handleSubmit(submitValid, () => setFormError(null))(event);

  async function decide(approved: boolean) {
    if (!challenge) return;
    setChallengeBusy(approved ? "approve" : "decline");
    const result = await confirmPaymentAction({ orderNumber: challenge.orderNumber, actionToken: challenge.actionToken, approved, accessToken: challenge.accessToken });
    setChallengeBusy(null);
    if (result.ok && result.data.status === "succeeded") {
      setChallenge(null);
      finish(result.data);
      return;
    }
    setChallenge(null);
    if (!result.ok) handleFailure(result);
  }

  /* ---------------------------------------------------------------- render */

  const submitDisabled = busy || quoting || !quote?.selectedShipping;
  const chosenMethod = quote?.shippingQuotes.find((q) => q.methodId === methodId);
  const cardDigits = digitsOnly(cardNumber ?? "");
  const contactDone = isGuest ? /.+@.+..+/.test(emailValue ?? "") : true;
  const shippingDone = Boolean(shipLine1 && shipCity);
  // The shipping method is preselected, so "has a value" proves nothing: the step counts as done only once contact and address are.
  const methodDone = contactDone && shippingDone && Boolean(chosenMethod);
  const methodName = chosenMethod ? localize(chosenMethod.name, locale) : "";
  const steps: Step[] = [
    { id: "checkout-contact", label: t("steps.contact"), done: contactDone, summary: isGuest ? (emailValue ?? "") : (user?.email ?? "") },
    { id: "checkout-shipping", label: t("steps.shipTo"), done: shippingDone, summary: `${shipCity ?? ""}${country ? `, ${country}` : ""}` },
    {
      id: "checkout-method",
      label: t("steps.method"),
      done: methodDone,
      summary: methodName,
      ...(!methodDone && chosenMethod ? { pending: t("steps.defaultMethod", { name: methodName }) } : {}),
    },
    { id: "checkout-payment", label: t("steps.payment"), done: cardDigits.length >= 12, summary: cardDigits.length >= 12 ? `•••• ${cardDigits.slice(-4)}` : "" },
  ];

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] xl:gap-14">
        <div className="min-w-0 space-y-12">
          <StepStrip steps={steps} />

          {/* Mobile: collapsible summary with the running total always visible */}
          <details className="group border border-border-strong bg-surface lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
              <span className="flex items-center gap-2 font-medium">
                {t("summary.show")}
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </span>
              <span className="mono text-lg font-bold">{formatMoney(totals.total, locale, currency)}</span>
            </summary>
            <div className="border-t border-border p-4">
              <OrderSummaryPanel {...summaryProps} />
            </div>
          </details>

          <div ref={bannerRef} aria-live="polite">
            {formError ? (
              <Alert tone="danger">
                {formError}{" "}
                <Link href="/cart" className="font-medium underline underline-offset-4 hover:no-underline">
                  {t("reviewCart")}
                </Link>
              </Alert>
            ) : null}
          </div>

          <Section id="checkout-contact" step={1} title={t("contact.title")}>
            <div className="space-y-4">
              {isGuest ? (
                <>
                  <Field label={t("contact.email")} error={err("email")} hint={t("contact.emailHint")} required>
                    <Input type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} {...register("email")} />
                  </Field>
                  <p className="text-sm text-muted">
                    {t("contact.haveAccount")}{" "}
                    <Link href={{ pathname: "/login", query: { next: "/checkout" } }} className="font-medium text-primary-text underline underline-offset-4 hover:no-underline">
                      {t("contact.signIn")}
                    </Link>
                  </p>
                </>
              ) : (
                <p className="rounded-sm bg-surface-sunken px-4 py-3 text-sm">
                  {t("contact.signedInAs", { email: user.email })}
                </p>
              )}
              <Checkbox label={t("contact.newsletter")} {...register("newsletterOptIn")} />
            </div>
          </Section>

          <Section id="checkout-shipping" step={2} title={t("shipping.title")}>
            <ShippingAddressSection savedAddresses={savedAddresses} countries={countries} defaultCountry={defaultCountry} locale={locale} isGuest={isGuest} />
          </Section>

          <Section id="checkout-method" step={3} title={t("method.title")}>
            <ShippingMethodSection
              quotes={quote?.shippingQuotes ?? []}
              selectedId={methodId}
              onSelect={(id) => setValue("shippingMethodId", id, { shouldDirty: true, shouldValidate: true })}
              loading={quoting}
              locale={locale}
              currency={currency}
              {...(err("shippingMethodId") ? { error: err("shippingMethodId") as string } : {})}
            />
            {quoteError ? (
              <Alert tone="danger" className="mt-4">
                {quoteError}
              </Alert>
            ) : null}
          </Section>

          <Section id="checkout-payment" step={4} title={t("payment.title")}>
            <div className="space-y-8">
              <PaymentSection paymentError={paymentError} showTestCards={showTestCards} />
              <BillingSection countries={countries} />
            </div>
          </Section>

          <section aria-label={t("finish.label")} className="space-y-5 border-t border-border pt-8">
            <Field label={t("finish.note")} error={err("customerNote")} optional>
              <Textarea rows={3} maxLength={500} {...register("customerNote")} />
            </Field>
            <div>
              <Checkbox
                invalid={Boolean(err("acceptTerms"))}
                label={t.rich("finish.terms", {
                  terms: (chunks) => (
                    <Link href="/pages/terms" target="_blank" rel="noopener" className="font-medium text-primary-text underline underline-offset-4 hover:no-underline">
                      {chunks}
                    </Link>
                  ),
                  returns: (chunks) => (
                    <Link href="/pages/returns" target="_blank" rel="noopener" className="font-medium text-primary-text underline underline-offset-4 hover:no-underline">
                      {chunks}
                    </Link>
                  ),
                })}
                {...register("acceptTerms")}
              />
              {err("acceptTerms") ? (
                <p role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
                  {err("acceptTerms")}
                </p>
              ) : null}
            </div>

            <Button type="submit" size="lg" fullWidth loading={busy} disabled={submitDisabled} leftIcon={<LockKeyhole className="size-4.5" aria-hidden />}>
              {busy ? t("finish.processing") : t("finish.pay", { amount: chargeLabel })}
            </Button>
            <p className={cn("text-center text-[0.8125rem] text-muted", !quote?.selectedShipping && "text-warning")}>{quote?.selectedShipping ? t("finish.reassurance") : t("finish.needShipping")}</p>
          </section>
        </div>

        <aside className="hidden lg:block" aria-label={t("summary.title")}>
          <div className="reg-marks sticky top-20 border border-border-strong bg-surface p-6">
            <OrderSummaryPanel {...summaryProps} />
          </div>
        </aside>
      </form>

      <ThreeDSecureModal open={challenge !== null} amount={chargeLabel} busy={challengeBusy} onDecision={decide} />
    </FormProvider>
  );
}
