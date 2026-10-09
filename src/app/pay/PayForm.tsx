"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import type { Holes, Settings } from "@/content/settings";
import { todayIn } from "@/lib/dates";
import { formatPrice } from "@/content/menu";
import { cartsShortMessage } from "@/lib/carts/availability";
import {
  MAX_PLAYERS,
  cartPriceHint,
  maxCartsFor,
  quoteRound,
} from "@/lib/pricing";
import { DROPPED_MESSAGE } from "@/lib/rounds/checkout";
import {
  payFormSchema,
  resolveArrival,
  type ArrivalChoice,
  type PayForm as Fields,
} from "@/lib/rounds/form";
import { addDays } from "@/lib/time";
import { useRouter } from "next/navigation";
import {
  SquareCard,
  preloadSquare,
  type TokenizeFn,
} from "@/components/SquareCard";
import { checkCarts, payForRound, type CartCheck } from "./actions";

type Props = Pick<
  Settings,
  "greenFees" | "cartRental" | "timeZone" | "bookAheadDays" | "clubhouseHours"
>;

type FieldName = keyof Fields;
type Errors = Partial<Record<FieldName, string>>;

/** Element to scroll to and focus for each field, in page order. */
const fieldIds: [FieldName, string][] = [
  ["playDate", "pay-date"],
  ["holes", "pay-holes"],
  ["players", "pay-players"],
  ["carts", "pay-carts"],
  ["arrival", "pay-arrival"],
  ["arrivalTime", "pay-arrival-time"],
  ["name", "pay-name"],
  ["phone", "pay-phone"],
  ["email", "pay-email"],
];
const idOf = Object.fromEntries(fieldIds) as Record<FieldName, string>;
const errorId = (field: FieldName) => `${idOf[field]}-error`;

const noopSubscribe = () => () => {};

const arrivalLabels: Record<ArrivalChoice, string> = {
  now: "Now",
  "15": "~15 min",
  "30": "~30 min",
  later: "Pick a time",
};

/**
 * Pay to Play. After a successful payment the page is kept (hidden) by
 * Next's Activity cache; when it's hidden, remount the form so coming back
 * to /pay shows a fresh form, never a frozen "Paying…" one.
 */
export function PayForm(settings: Props) {
  const [instance, setInstance] = useState(0);
  const paid = useRef(false);
  useLayoutEffect(
    () => () => {
      if (paid.current) {
        paid.current = false;
        setInstance((n) => n + 1);
      }
    },
    [],
  );
  const onPaid = useCallback(() => {
    paid.current = true;
  }, []);
  return <PayFormFields key={instance} {...settings} onPaid={onPaid} />;
}

function PayFormFields({
  onPaid,
  ...settings
}: Props & { onPaid: () => void }) {
  // "Today" depends on the visitor's clock, so it's read in the browser only
  // (pages are prerendered); the server snapshot is null. The form renders
  // either way, assuming today, so a slow connection still shows it at once.
  const today = useSyncExternalStore(
    noopSubscribe,
    () => todayIn(settings.timeZone),
    () => null,
  );

  useEffect(() => preloadSquare(), []);

  const [dateInput, setPlayDate] = useState("");
  const [holes, setHoles] = useState<Holes>(9);
  const [players, setPlayers] = useState(1);
  const [cartsInput, setCarts] = useState(0);
  const [arrivalInput, setArrival] = useState<ArrivalChoice>("now");
  const [arrivalTime, setArrivalTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Name, phone and email are uncontrolled so anything typed on a slow
  // connection before the page's JavaScript arrives survives hydration;
  // pick it up once we're running.
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setName(nameRef.current?.value ?? "");
    setPhone(phoneRef.current?.value ?? "");
    setEmail(emailRef.current?.value ?? "");
  }, []);
  const [errors, setErrors] = useState<Errors>({});
  const [checkState, setCheckState] = useState<{
    key: string;
    result: CartCheck;
  } | null>(null);
  const [checkRun, setCheckRun] = useState(0);
  const [checking, startCheck] = useTransition();
  // Once shown, the card section stays: editing a field never loses the card.
  const [showCard, setShowCard] = useState(false);

  // Derived values: defaults and limits follow the other fields.
  const playDate = dateInput || today || "";
  const isToday = dateInput === "" || dateInput === today;
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
        let result: CartCheck;
        try {
          result = await checkCarts({
            playDate,
            arrival,
            arrivalTime: arrivalTime || undefined,
            holes,
          });
        } catch {
          result = {
            ok: false,
            message: "Couldn't check carts. Set Carts to 0, or try again.",
          };
        }
        setCheckState({ key: checkKey, result });
        // A fresh answer replaces "Still checking…" style errors.
        setErrors((prev) => {
          if (!prev.carts) return prev;
          const next = { ...prev };
          delete next.carts;
          return next;
        });
      });
    }, 300);
    return () => clearTimeout(id);
  }, [checkKey, checkRun, playDate, arrival, arrivalTime, holes]);
  const recheckCarts = () => {
    setCheckState(null);
    setCheckRun((n) => n + 1);
  };

  const cartsShort =
    carts > 0 && cartCheck?.ok === true && cartCheck.available < carts;

  const formValues = {
    playDate,
    holes,
    players,
    carts,
    arrival,
    arrivalTime: arrival === "later" && arrivalTime ? arrivalTime : undefined,
    name,
    phone,
    email,
  };

  /** Every problem at once: schema, arrival time and the cart check. */
  function validate(): Errors {
    const next: Errors = {};
    const parsed = payFormSchema.safeParse(formValues);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as FieldName] ??= issue.message;
      }
    }
    if (!next.playDate && !next.arrival && !next.arrivalTime) {
      const resolved = resolveArrival(formValues, settings);
      if (!resolved.ok) next[resolved.field as FieldName] = resolved.message;
    }
    if (carts > 0 && !next.carts && !next.arrivalTime && !next.playDate) {
      if (checking || !cartCheck) {
        next.carts = "Still checking carts…";
        if (!checking) recheckCarts();
      } else if (!cartCheck.ok) {
        next.carts = "Couldn't check carts. Set Carts to 0, or try again.";
        recheckCarts();
      } else if (cartsShort) {
        next.carts = cartsShortMessage(cartCheck.available);
      }
    }
    return next;
  }

  function showErrors(next: Errors) {
    setErrors(next);
    const first = fieldIds.find(([field]) => next[field]);
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(first[1]);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus({ preventScroll: true });
    });
  }

  /** Wrap a setter so changing a field clears its error (and related ones). */
  function edit<T>(
    set: (value: T) => void,
    ...fields: FieldName[]
  ): (value: T) => void {
    return (value) => {
      set(value);
      setErrors((prev) => {
        if (!fields.some((f) => prev[f])) return prev;
        const next = { ...prev };
        for (const f of fields) delete next[f];
        return next;
      });
    };
  }

  const router = useRouter();
  const tokenize = useRef<TokenizeFn | null>(null);
  // The attempt in flight: kept until a definite answer, so a retry after a
  // dropped connection sends the same checkout ID, token and details and
  // can never charge twice.
  const attempt = useRef<{
    id: string;
    token: string;
    values: typeof formValues;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const onCardReady = useCallback((fn: TokenizeFn | null) => {
    tokenize.current = fn;
    setCardReady(!!fn);
  }, []);

  async function pay(walletToken?: string) {
    if (paying) return;
    let current = attempt.current;
    if (!current) {
      const problems = validate();
      if (Object.keys(problems).length) {
        setPayError(null);
        showErrors(problems);
        return;
      }
    }
    setPaying(true);
    setPayError(null);
    let navigating = false;
    try {
      if (!current) {
        let token = walletToken;
        if (!token) {
          if (!tokenize.current) return;
          const card = await tokenize.current();
          if (!card.ok) {
            setPayError(card.message);
            return;
          }
          token = card.token;
        }
        current = { id: crypto.randomUUID(), token, values: formValues };
        attempt.current = current;
      }

      const result = await payForRound(
        current.id,
        current.values,
        current.token,
      );
      if (result.ok) {
        attempt.current = null;
        navigating = true;
        onPaid();
        // Replace, so Back from the receipt never lands on this attempt.
        router.replace(`/pay/receipt/${result.receiptId}`);
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
      if (result.cartsChanged) {
        recheckCarts();
        showErrors({ carts: result.message });
      } else if (result.field) {
        showErrors({ [result.field]: result.message });
        setPayError(result.message);
      } else {
        setPayError(result.message);
      }
    } catch {
      // The request (or Square's card form) lost the connection. If the
      // attempt reached the server it may have charged, so keep it as is.
      setRetrying(!!attempt.current);
      setPayError(DROPPED_MESSAGE);
    } finally {
      if (!navigating) setPaying(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (showCard) {
      void pay();
      return;
    }
    const problems = validate();
    if (Object.keys(problems).length) {
      showErrors(problems);
      return;
    }
    setErrors({});
    setShowCard(true);
  }

  const a11y = (field: FieldName) => ({
    id: idOf[field],
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? errorId(field) : undefined,
  });

  // Cart messages (live status, or the error from the last tap) share one box.
  const cartMessage =
    carts === 0
      ? null
      : errors.carts
        ? { text: errors.carts, warn: true }
        : needsTime || errors.arrival || errors.arrivalTime
          ? {
              text: needsTime
                ? "Pick an arrival time to check carts."
                : "Fix the arrival time to check carts.",
              warn: false,
            }
          : checking || !cartCheck
            ? { text: "Checking carts…", warn: false }
            : !cartCheck.ok
              ? { text: cartCheck.message, warn: true }
              : cartsShort
                ? { text: cartsShortMessage(cartCheck.available), warn: true }
                : {
                    text: `Cart${carts === 1 ? "" : "s"} available.`,
                    warn: false,
                  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-7">
      <fieldset disabled={retrying} className="min-w-0 space-y-7">
        <Field
          label="Date"
          htmlFor={idOf.playDate}
          field="playDate"
          error={errors.playDate}
        >
          <input
            {...a11y("playDate")}
            type="date"
            value={playDate}
            min={today ?? undefined}
            max={today ? addDays(today, settings.bookAheadDays) : undefined}
            onChange={(e) =>
              edit(
                setPlayDate,
                "playDate",
                "arrival",
                "arrivalTime",
                "carts",
              )(e.target.value)
            }
            className="input"
          />
        </Field>

        <Field label="Holes" field="holes" group>
          <Segmented
            options={[
              { value: 9, label: "9 holes" },
              { value: 18, label: "18 holes" },
            ]}
            value={holes}
            onChange={edit(setHoles, "carts")}
          />
        </Field>

        {/* Two columns on a phone; stacks only when large text makes the steppers too wide. */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-4">
          <Field label="Players" field="players" group>
            <Stepper
              value={players}
              min={1}
              max={MAX_PLAYERS}
              onChange={edit(setPlayers, "players", "carts")}
              label="players"
            />
          </Field>
          <Field
            label="Carts"
            field="carts"
            hint={cartPriceHint(settings.cartRental, holes)}
            // Shown in the cart status box below when there is one.
            error={carts === 0 ? errors.carts : undefined}
            describedBy={carts > 0 ? "pay-carts-status" : undefined}
            group
          >
            <Stepper
              value={carts}
              min={0}
              max={maxCarts}
              onChange={edit(setCarts, "carts", "arrivalTime")}
              label="carts"
            />
          </Field>
        </div>

        {cartMessage && (
          <p
            id="pay-carts-status"
            role="status"
            className={`rounded-lg px-4 py-3 text-sm ${
              cartMessage.warn
                ? "bg-amber-50 text-amber-900"
                : "bg-stone-100 text-stone-700"
            }`}
          >
            {cartMessage.text}
          </p>
        )}

        {isToday ? (
          <Field
            label="Arriving"
            field="arrival"
            error={errors.arrival ?? errors.arrivalTime}
            errorFor={errors.arrival ? "arrival" : "arrivalTime"}
            group
          >
            <div className="flex flex-wrap gap-2">
              {(["now", "15", "30", "later"] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={arrival === choice}
                  onClick={() =>
                    edit(setArrival, "arrival", "arrivalTime", "carts")(choice)
                  }
                  className={`chip ${arrival === choice ? "chip-on" : ""}`}
                >
                  {arrivalLabels[choice]}
                </button>
              ))}
            </div>
            {arrival === "later" && (
              <input
                {...a11y("arrivalTime")}
                type="time"
                value={arrivalTime}
                onChange={(e) =>
                  edit(setArrivalTime, "arrivalTime", "carts")(e.target.value)
                }
                aria-label="Arrival time"
                className="input mt-3 max-w-40"
              />
            )}
          </Field>
        ) : (
          <Field
            label="Arrival time"
            htmlFor={idOf.arrivalTime}
            field="arrivalTime"
            hint={carts > 0 ? "Needed to hold a cart" : "Optional"}
            error={errors.arrivalTime ?? errors.arrival}
          >
            <input
              {...a11y("arrivalTime")}
              type="time"
              value={arrivalTime}
              onChange={(e) =>
                edit(setArrivalTime, "arrivalTime", "carts")(e.target.value)
              }
              className="input max-w-40"
            />
            {carts === 0 && !arrivalTime && (
              <span className="mt-1 block text-sm text-stone-600">
                Leave it blank to come any time that day.
              </span>
            )}
          </Field>
        )}

        <fieldset className="space-y-4">
          <legend className="text-lg font-bold">Your details</legend>
          <Field
            label="Name"
            htmlFor={idOf.name}
            field="name"
            error={errors.name}
          >
            <input
              {...a11y("name")}
              ref={nameRef}
              onChange={(e) => edit(setName, "name")(e.target.value)}
              autoComplete="name"
              className="input"
            />
          </Field>
          <Field
            label="Phone"
            htmlFor={idOf.phone}
            field="phone"
            error={errors.phone}
          >
            <input
              {...a11y("phone")}
              type="tel"
              ref={phoneRef}
              onChange={(e) => edit(setPhone, "phone")(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
              className="input"
            />
          </Field>
          <Field
            label="Email (optional)"
            htmlFor={idOf.email}
            field="email"
            error={errors.email}
          >
            <input
              {...a11y("email")}
              type="email"
              ref={emailRef}
              onChange={(e) => edit(setEmail, "email")(e.target.value)}
              autoComplete="email"
              inputMode="email"
              className="input"
            />
          </Field>
        </fieldset>
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

      {!showCard && (
        <button
          // Not a submit button until the script runs (today is known), so
          // a tap on a slow connection can't reload the page and lose input.
          type={today ? "submit" : "button"}
          className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
        >
          Continue to payment
        </button>
      )}
      {showCard && (
        <section aria-labelledby="card-heading" className="space-y-4">
          <h2 id="card-heading" className="text-lg font-bold">
            Payment
          </h2>
          {/* Wallet buttons only appear here, after Continue validated the
              form; a wallet payment is re-validated before it's charged. */}
          <SquareCard
            onReady={onCardReady}
            amountCents={quote?.totalCents}
            label="Green fees"
            onWalletToken={(token) => pay(token)}
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
            type="submit"
            disabled={!cardReady || paying}
            className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
          >
            {paying
              ? "Paying…"
              : `Pay ${quote ? formatPrice(quote.totalCents) : ""}`}
          </button>
          <p className="text-center text-sm text-stone-500">
            Test mode: use card 4111 1111 1111 1111, any future date, CVV 111.
          </p>
        </section>
      )}
    </form>
  );
}

/**
 * A labelled form row. Single inputs use <label htmlFor>; groups of buttons
 * (group) use role=group, because a <label> would forward taps on its text
 * to the first button inside it. Groups are focusable (tabIndex -1) so a
 * failed submit can move focus to them.
 */
function Field({
  label,
  field,
  htmlFor,
  error,
  errorFor = field,
  describedBy,
  hint,
  group = false,
  children,
}: {
  label: string;
  field: FieldName;
  htmlFor?: string;
  error?: string;
  /** Which field's error id the message uses (a group can show a child's error). */
  errorFor?: FieldName;
  describedBy?: string;
  hint?: string;
  group?: boolean;
  children: React.ReactNode;
}) {
  const labelId = `${idOf[field]}-label`;
  const heading = (
    <span className="mb-1.5 flex items-baseline justify-between font-medium">
      {group ? (
        <span id={labelId}>{label}</span>
      ) : (
        <label htmlFor={htmlFor}>{label}</label>
      )}
      {hint && (
        <span className="text-sm font-normal text-stone-500">{hint}</span>
      )}
    </span>
  );
  const message = error && (
    <span id={errorId(errorFor)} className="mt-1 block text-sm text-red-700">
      {error}
    </span>
  );
  return group ? (
    <div
      id={idOf[field]}
      role="group"
      tabIndex={-1}
      aria-labelledby={labelId}
      aria-describedby={
        [error ? errorId(errorFor) : null, describedBy]
          .filter(Boolean)
          .join(" ") || undefined
      }
      className="outline-none"
    >
      {heading}
      {children}
      {message}
    </div>
  ) : (
    <div>
      {heading}
      {children}
      {message}
    </div>
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
