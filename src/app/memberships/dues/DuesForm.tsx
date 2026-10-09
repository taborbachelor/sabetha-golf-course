"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { installmentLabels } from "@/content/memberships";
import { FieldError } from "@/components/FieldError";
import {
  SquareCard,
  preloadSquare,
  type TokenizeFn,
} from "@/components/SquareCard";
import { errorId, errorsByField, focusFirstInvalid } from "@/lib/forms";
import {
  INSTALLMENTS,
  duesAmount,
  duesFormSchema,
  type DuesForm as Fields,
  type Installment,
} from "@/lib/memberships/dues";
import { formatDollars } from "@/lib/money";
import { DROPPED_MESSAGE } from "@/lib/rounds/checkout";
import { payDues } from "./actions";

export type DuesTier = {
  id: string;
  name: string;
  priceCents: number;
  isSample: boolean;
};

type Errors = Partial<Record<keyof Fields, string>>;
type TokenResult = Awaited<ReturnType<TokenizeFn>>;

export function DuesForm({ tiers }: { tiers: DuesTier[] }) {
  const [tierId, setTierId] = useState("");
  const [installment, setInstallment] = useState<Installment>("full");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [focusTick, setFocusTick] = useState(0);
  // Once the card form is shown it stays mounted, so editing the name or
  // tier afterwards never throws away a typed card. Pay re-checks the form.
  const [cardShown, setCardShown] = useState(false);

  const tier = tiers.find((t) => t.id === tierId);
  const amount = tier ? duesAmount(tier.priceCents, installment) : null;
  const formValues = { tierId, installment, name, email };

  /** Every problem with the form at once (empty when it can be paid). */
  function check(): Errors {
    const parsed = duesFormSchema.safeParse(formValues);
    const found: Errors = parsed.success
      ? {}
      : errorsByField<keyof Fields>(parsed.error.issues);
    if (!found.tierId && tier && tier.priceCents <= 0) {
      found.tierId =
        "Dues for this membership type aren't set yet. Please contact the Club Secretary.";
    }
    return found;
  }
  const canPay = Object.keys(check()).length === 0;

  /** Show the errors (or clear them); true when the form is good to pay. */
  function validate(): boolean {
    const found = check();
    setErrors(found);
    if (Object.keys(found).length === 0) return true;
    setFocusTick((n) => n + 1);
    return false;
  }

  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (focusTick) focusFirstInvalid(formRef.current);
  }, [focusTick]);

  function clearError(field: keyof Fields) {
    if (!errors[field]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  const router = useRouter();
  useEffect(() => preloadSquare(), []);
  const tokenize = useRef<TokenizeFn | null>(null);
  // The attempt in flight: kept until a definite answer, so a retry after a
  // dropped connection sends the same checkout ID, token and details, and
  // Square replays the charge instead of taking a second one.
  const attempt = useRef<{
    id: string;
    token: string;
    values: typeof formValues;
  } | null>(null);
  // While an attempt may have charged, the details are locked.
  const [retrying, setRetrying] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const onCardReady = useCallback((fn: TokenizeFn | null) => {
    tokenize.current = fn;
    setCardReady(!!fn);
  }, []);

  const cardSection = useRef<HTMLElement>(null);
  useEffect(() => {
    if (cardShown) cardSection.current?.scrollIntoView({ block: "start" });
  }, [cardShown]);

  /** Charge a card or wallet token; shared by the Pay button and wallets. */
  async function pay(getToken: () => Promise<TokenResult>) {
    if (paying) return;
    let current = attempt.current;
    if (!current && !validate()) return;
    setPaying(true);
    setPayError(null);
    let navigating = false;
    try {
      if (!current) {
        const source = await getToken();
        if (!source.ok) {
          setPayError(source.message);
          return;
        }
        current = {
          id: crypto.randomUUID(),
          token: source.token,
          values: formValues,
        };
        attempt.current = current;
      }

      const result = await payDues(current.id, current.values, current.token);
      if (result.ok) {
        attempt.current = null;
        navigating = true;
        // Replace, so Back from the receipt never lands on this attempt.
        router.replace(`/memberships/dues/receipt/${result.receiptId}`);
        return;
      }
      if (result.retrySame) {
        setRetrying(true);
        setPayError(result.message);
        return;
      }
      // A definite answer: the next tap is a new attempt.
      attempt.current = null;
      setRetrying(false);
      if (result.field) {
        setErrors({ [result.field]: result.message });
        setFocusTick((n) => n + 1);
      }
      setPayError(result.message);
    } catch {
      // The request (or Square's card form) lost the connection. If the
      // attempt reached the server it may have charged, so keep it as is.
      setRetrying(!!attempt.current);
      setPayError(DROPPED_MESSAGE);
    } finally {
      if (!navigating) setPaying(false);
    }
  }

  function onPay() {
    const fn = tokenize.current;
    if (!fn) return;
    void pay(fn);
  }

  async function onWalletToken(token: string) {
    await pay(async () => ({ ok: true, token }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setPayError(null);
    setCardShown(true);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-7">
      {/* Details are locked (disabled) while an attempt that may have
          charged is waiting for its retry. */}
      <fieldset disabled={retrying}>
        <legend id="tier-legend" className="mb-2 font-medium">
          Membership type
        </legend>
        <div
          role="radiogroup"
          aria-labelledby="tier-legend"
          aria-invalid={!!errors.tierId}
          aria-describedby={errorId("tierId")}
          className="grid scroll-mt-24 gap-2"
        >
          {tiers.map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-300 bg-white p-3 has-checked:border-green-800 has-checked:bg-green-50"
            >
              <input
                type="radio"
                name="tierId"
                value={t.id}
                checked={tierId === t.id}
                onChange={() => {
                  setTierId(t.id);
                  clearError("tierId");
                }}
                className="size-5 shrink-0 accent-green-800"
              />
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{t.name}</span>
                {t.isSample && (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                    Sample
                  </span>
                )}
                <span className="ml-auto text-sm text-stone-700">
                  {t.priceCents > 0
                    ? `${formatDollars(t.priceCents)}/yr`
                    : "Ask"}
                </span>
              </span>
            </label>
          ))}
        </div>
        <FieldError field="tierId" message={errors.tierId} />
      </fieldset>

      <fieldset disabled={retrying}>
        <legend className="mb-2 font-medium">Paying</legend>
        {/* Three across when they fit; stacked on narrow screens or large text. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2">
          {INSTALLMENTS.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={installment === i}
              onClick={() => {
                setInstallment(i);
                clearError("installment");
              }}
              className={`chip flex-col justify-center py-2 text-center ${installment === i ? "chip-on" : ""}`}
            >
              <span>{installmentLabels[i].label}</span>
              <span className="text-xs font-normal opacity-80">
                {installmentLabels[i].due}
              </span>
            </button>
          ))}
        </div>
        <FieldError field="installment" message={errors.installment} />
      </fieldset>

      <fieldset disabled={retrying} className="space-y-4">
        <legend className="text-lg font-bold">Member</legend>
        <label className="block">
          <span className="mb-1.5 block font-medium">Member name</span>
          <input
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errorId("name")}
            className="input"
          />
          <FieldError field="name" message={errors.name} />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-medium">Email</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError("email");
            }}
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!errors.email}
            aria-describedby={errorId("email")}
            className="input"
          />
          <FieldError field="email" message={errors.email} />
        </label>
        <p className="text-sm text-stone-600">
          Use the name and email the club has on file, so the Secretary can
          match your payment.
        </p>
      </fieldset>

      {tier && amount !== null && amount > 0 && (
        <section
          aria-label="Total"
          className="flex flex-wrap justify-between gap-x-4 rounded-xl border border-stone-200 bg-white p-4 font-bold"
        >
          <span className="min-w-0">
            {tier.name}, {installmentLabels[installment].label.toLowerCase()}
          </span>
          <span>{formatDollars(amount)}</span>
        </section>
      )}

      {!cardShown && (
        <button
          type="submit"
          className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900"
        >
          Continue to payment
        </button>
      )}
      {cardShown && (
        <section
          ref={cardSection}
          aria-labelledby="card-heading"
          className="scroll-mt-4 space-y-4 sm:scroll-mt-24"
        >
          <h2 id="card-heading" className="text-lg font-bold">
            Payment
          </h2>
          <SquareCard
            onReady={onCardReady}
            amountCents={amount ?? 0}
            label="Membership dues"
            // Wallet buttons only while the form is complete and payable.
            onWalletToken={canPay ? onWalletToken : undefined}
            disabled={paying || retrying}
          />
          {payError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-3 text-red-800"
            >
              {payError}
              {retrying && (
                <span className="mt-1 block text-sm">
                  Your details are locked until this payment finishes.
                </span>
              )}
            </p>
          )}
          <button
            type="button"
            onClick={onPay}
            disabled={!cardReady || paying}
            className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
          >
            {paying
              ? "Paying…"
              : amount && amount > 0
                ? `Pay ${formatDollars(amount)}`
                : "Pay"}
          </button>
          <p className="text-center text-sm text-stone-500">
            Test mode: use card 4111 1111 1111 1111, any future date, CVV 111.
          </p>
        </section>
      )}
    </form>
  );
}
