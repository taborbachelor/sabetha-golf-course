"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import type { Holes, Settings } from "@/content/settings";
import { todayIn } from "@/lib/dates";
import { formatPrice } from "@/content/menu";
import { MAX_PLAYERS, maxCartsFor, quoteRound } from "@/lib/pricing";
import {
  payFormSchema,
  type ArrivalChoice,
  type PayForm as Fields,
} from "@/lib/rounds/form";
import { addDays } from "@/lib/time";
import { checkCarts, type CartCheck } from "./actions";

type Props = Pick<
  Settings,
  "greenFees" | "cartRental" | "timeZone" | "bookAheadDays"
>;

type Errors = Partial<Record<keyof Fields, string>>;

const noopSubscribe = () => () => {};

const arrivalLabels: Record<ArrivalChoice, string> = {
  now: "Now",
  "15": "~15 min",
  "30": "~30 min",
  later: "Pick a time",
};

export function PayForm(settings: Props) {
  // "Today" depends on the visitor's clock, so it's read in the browser only
  // (pages are prerendered); the server snapshot is null.
  const today = useSyncExternalStore(
    noopSubscribe,
    () => todayIn(settings.timeZone),
    () => null,
  );

  const [dateInput, setPlayDate] = useState("");
  const [holes, setHoles] = useState<Holes>(9);
  const [players, setPlayers] = useState(1);
  const [cartsInput, setCarts] = useState(0);
  const [arrivalInput, setArrival] = useState<ArrivalChoice>("now");
  const [arrivalTime, setArrivalTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [checkState, setCheckState] = useState<{
    key: string;
    result: CartCheck;
  } | null>(null);
  const [checking, startCheck] = useTransition();
  const [readyKey, setReadyKey] = useState<string | null>(null);

  // Derived values: defaults and limits follow the other fields.
  const playDate = dateInput || today || "";
  const isToday = playDate !== "" && playDate === today;
  const maxCarts = maxCartsFor(players);
  const carts = Math.min(cartsInput, maxCarts);
  const arrival: ArrivalChoice = isToday ? arrivalInput : "later"; // other days have no "now"

  const quote = useMemo(() => {
    if (!playDate) return null;
    try {
      return quoteRound({ playDate, holes, players, carts }, settings);
    } catch {
      return null;
    }
  }, [playDate, holes, players, carts, settings]);

  // Check cart inventory whenever it matters. Results are keyed to the
  // inputs they answer, so a stale answer is never shown.
  const needsTime = arrival === "later" && !arrivalTime;
  const checkKey =
    carts > 0 && playDate && !needsTime
      ? JSON.stringify([playDate, arrival, arrivalTime, holes])
      : null;
  const cartCheck =
    checkKey && checkState?.key === checkKey ? checkState.result : null;
  useEffect(() => {
    if (!checkKey) return;
    const id = setTimeout(() => {
      startCheck(async () => {
        const result = await checkCarts({
          playDate,
          arrival,
          arrivalTime: arrivalTime || undefined,
          holes,
        });
        setCheckState({ key: checkKey, result });
      });
    }, 300);
    return () => clearTimeout(id);
  }, [checkKey, playDate, arrival, arrivalTime, holes]);

  const cartsShort =
    carts > 0 && cartCheck?.ok === true && cartCheck.available < carts;

  const formKey = JSON.stringify([
    playDate,
    holes,
    players,
    carts,
    arrival,
    arrivalTime,
    name,
    phone,
    email,
  ]);
  const ready = readyKey === formKey;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = payFormSchema.safeParse({
      playDate,
      holes,
      players,
      carts,
      arrival,
      arrivalTime: arrival === "later" ? arrivalTime : undefined,
      name,
      phone,
      email,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Fields;
        next[key] ??= issue.message;
      }
      setErrors(next);
      setReadyKey(null);
      return;
    }
    setErrors({});
    if (cartsShort || (carts > 0 && cartCheck?.ok !== true)) return;
    setReadyKey(formKey);
  }

  if (!today) {
    return <p className="text-stone-600">Loading…</p>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-7">
      <Field label="Date" error={errors.playDate}>
        <input
          type="date"
          value={playDate}
          min={today}
          max={addDays(today, settings.bookAheadDays)}
          onChange={(e) => setPlayDate(e.target.value)}
          className="input"
        />
      </Field>

      <Field label="Holes" group>
        <Segmented
          options={[
            { value: 9, label: "9 holes" },
            { value: 18, label: "18 holes" },
          ]}
          value={holes}
          onChange={setHoles}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Players" group>
          <Stepper
            value={players}
            min={1}
            max={MAX_PLAYERS}
            onChange={setPlayers}
            label="players"
          />
        </Field>
        <Field
          label="Carts"
          error={errors.carts}
          hint={`Up to ${maxCarts}`}
          group
        >
          <Stepper
            value={carts}
            min={0}
            max={maxCarts}
            onChange={setCarts}
            label="carts"
          />
        </Field>
      </div>

      <Field label="Arriving" error={errors.arrivalTime} group>
        <div className="flex flex-wrap gap-2">
          {(isToday
            ? (["now", "15", "30", "later"] as const)
            : (["later"] as const)
          ).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={arrival === choice}
              onClick={() => setArrival(choice)}
              className={`chip ${arrival === choice ? "chip-on" : ""}`}
            >
              {arrivalLabels[choice]}
            </button>
          ))}
        </div>
        {arrival === "later" && (
          <input
            type="time"
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            aria-label="Arrival time"
            className="input mt-3 max-w-40"
          />
        )}
      </Field>

      {carts > 0 && (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            cartsShort || cartCheck?.ok === false
              ? "bg-amber-50 text-amber-900"
              : "bg-stone-100 text-stone-700"
          }`}
        >
          {needsTime
            ? "Pick an arrival time to check carts."
            : checking || !cartCheck
              ? "Checking carts…"
              : !cartCheck.ok
                ? cartCheck.message
                : cartsShort
                  ? cartCheck.available === 0
                    ? "No carts available online for that time. Ask at the clubhouse, or continue without a cart."
                    : `Only ${cartCheck.available} cart${cartCheck.available === 1 ? "" : "s"} available online for that time. Ask at the clubhouse for more.`
                  : `Cart${carts === 1 ? "" : "s"} available.`}
        </p>
      )}

      <fieldset className="space-y-4">
        <legend className="text-lg font-bold">Your details</legend>
        <Field label="Name" error={errors.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="input"
          />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            className="input"
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            className="input"
          />
        </Field>
      </fieldset>

      {quote && (
        <section
          aria-label="Total"
          className="rounded-xl border border-stone-200 bg-white p-4"
        >
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>
                {players} × {holes} holes (
                {quote.weekend ? "weekend" : "weekday"})
              </dt>
              <dd>{formatPrice(quote.greenFeesCents)}</dd>
            </div>
            {carts > 0 && (
              <div className="flex justify-between">
                <dt>
                  {carts} cart{carts === 1 ? "" : "s"}
                </dt>
                <dd>{formatPrice(quote.cartFeesCents)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatPrice(quote.totalCents)}</dd>
            </div>
          </dl>
        </section>
      )}

      <button
        type="submit"
        disabled={cartsShort || checking}
        className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
      >
        Continue to payment
      </button>
      {ready && (
        <p
          role="status"
          className="rounded-lg bg-green-50 px-4 py-3 text-green-900"
        >
          Everything checks out. Online payment is the next step and is coming
          soon; for now, pay at the clubhouse or the box at hole #1.
        </p>
      )}
    </form>
  );
}

/**
 * A labelled form row. Single inputs use <label>; groups of buttons
 * (group) use role=group, because a <label> would forward taps on its text
 * to the first button inside it.
 */
function Field({
  label,
  error,
  hint,
  group = false,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  group?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  const heading = (
    <span
      id={id}
      className="mb-1.5 flex items-baseline justify-between font-medium"
    >
      {label}
      {hint && (
        <span className="text-sm font-normal text-stone-500">{hint}</span>
      )}
    </span>
  );
  const message = error && (
    <span className="mt-1 block text-sm text-red-700">{error}</span>
  );
  return group ? (
    <div role="group" aria-labelledby={id}>
      {heading}
      {children}
      {message}
    </div>
  ) : (
    <label className="block">
      {heading}
      {children}
      {message}
    </label>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`chip justify-center ${value === o.value ? "chip-on" : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Fewer ${label}`}
        className="chip size-12 justify-center text-xl"
      >
        −
      </button>
      <span
        className="w-8 text-center text-xl font-bold tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`More ${label}`}
        className="chip size-12 justify-center text-xl"
      >
        +
      </button>
    </div>
  );
}
