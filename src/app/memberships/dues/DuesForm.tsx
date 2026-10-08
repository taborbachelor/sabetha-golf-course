"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/content/menu";
import { installmentLabels } from "@/content/memberships";
import { SquareCard, type TokenizeFn } from "@/components/SquareCard";
import {
  INSTALLMENTS,
  duesAmount,
  duesFormSchema,
  type DuesForm as Fields,
  type Installment,
} from "@/lib/memberships/dues";
import { payDues } from "./actions";

export type DuesTier = {
  id: string;
  name: string;
  priceCents: number;
  isSample: boolean;
};

type Errors = Partial<Record<keyof Fields, string>>;

export function DuesForm({ tiers }: { tiers: DuesTier[] }) {
  const [tierId, setTierId] = useState("");
  const [installment, setInstallment] = useState<Installment>("full");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [readyKey, setReadyKey] = useState<string | null>(null);

  const tier = tiers.find((t) => t.id === tierId);
  const amount = tier ? duesAmount(tier.priceCents, installment) : null;
  const formValues = { tierId, installment, name, email };
  const formKey = JSON.stringify(formValues);
  const ready = readyKey === formKey;

  const router = useRouter();
  const tokenize = useRef<TokenizeFn | null>(null);
  // Kept only when the card was charged but saving failed, so the retry
  // replays the same charge instead of making a new one.
  const attempt = useRef<{ id: string; token: string; key: string } | null>(
    null,
  );
  const [cardReady, setCardReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const onCardReady = useCallback((fn: TokenizeFn | null) => {
    tokenize.current = fn;
    setCardReady(!!fn);
  }, []);

  async function onPay() {
    if (!tokenize.current || paying) return;
    setPaying(true);
    setPayError(null);

    let current = attempt.current?.key === formKey ? attempt.current : null;
    if (!current) {
      const card = await tokenize.current();
      if (!card.ok) {
        setPayError(card.message);
        setPaying(false);
        return;
      }
      current = { id: crypto.randomUUID(), token: card.token, key: formKey };
    }

    const result = await payDues(current.id, formValues, current.token);
    if (result.ok) {
      router.push(`/memberships/dues/receipt/${result.receiptId}`);
      return;
    }
    attempt.current = result.retrySame ? current : null;
    if (result.field) {
      setErrors({ [result.field]: result.message });
      setReadyKey(null);
    }
    setPayError(result.message);
    setPaying(false);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = duesFormSchema.safeParse(formValues);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as keyof Fields] ??= issue.message;
      }
      setErrors(next);
      setReadyKey(null);
      return;
    }
    setErrors({});
    setPayError(null);
    setReadyKey(formKey);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-7">
      <fieldset>
        <legend className="mb-2 font-medium">Membership type</legend>
        <div className="grid gap-2">
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
                onChange={() => setTierId(t.id)}
                className="size-5 accent-green-800"
              />
              <span className="flex flex-1 flex-wrap items-center gap-2 font-semibold">
                {t.name}
                {t.isSample && (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-600">
                    Sample
                  </span>
                )}
              </span>
              <span className="text-sm text-stone-700">
                {t.priceCents > 0 ? `${formatPrice(t.priceCents)}/yr` : "Ask"}
              </span>
            </label>
          ))}
        </div>
        <FieldError message={errors.tierId} />
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-medium">Paying</legend>
        <div className="grid grid-cols-3 gap-2">
          {INSTALLMENTS.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={installment === i}
              onClick={() => setInstallment(i)}
              className={`chip flex-col justify-center py-2 text-center ${installment === i ? "chip-on" : ""}`}
            >
              <span>{installmentLabels[i].label}</span>
              <span className="text-xs font-normal opacity-80">
                {installmentLabels[i].due}
              </span>
            </button>
          ))}
        </div>
        <FieldError message={errors.installment} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-bold">Member</legend>
        <label className="block">
          <span className="mb-1.5 block font-medium">Member name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="input"
          />
          <FieldError message={errors.name} />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            className="input"
          />
          <FieldError message={errors.email} />
        </label>
        <p className="text-sm text-stone-600">
          Use the name and email the club has on file, so the Secretary can
          match your payment.
        </p>
      </fieldset>

      {tier && amount !== null && amount > 0 && (
        <section
          aria-label="Total"
          className="flex justify-between rounded-xl border border-stone-200 bg-white p-4 font-bold"
        >
          <span>
            {tier.name}, {installmentLabels[installment].label.toLowerCase()}
          </span>
          <span>{formatPrice(amount)}</span>
        </section>
      )}

      {!ready && (
        <button
          type="submit"
          className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900"
        >
          Continue to payment
        </button>
      )}
      {ready && amount !== null && (
        <section aria-labelledby="card-heading" className="space-y-4">
          <h2 id="card-heading" className="text-lg font-bold">
            Card
          </h2>
          <SquareCard onReady={onCardReady} />
          {payError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-3 text-red-800"
            >
              {payError}
            </p>
          )}
          <button
            type="button"
            onClick={onPay}
            disabled={!cardReady || paying}
            className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
          >
            {paying ? "Paying…" : `Pay ${formatPrice(amount)}`}
          </button>
          <p className="text-center text-sm text-stone-500">
            Test mode: use card 4111 1111 1111 1111, any future date, CVV 111.
          </p>
        </section>
      )}
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1 block text-sm text-red-700">{message}</span>;
}
