"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { formatPrice } from "@/content/menu";
import { kitchenLabels } from "@/lib/orders/kitchen";
import { formatTime } from "@/lib/hours";
import {
  availableCarts,
  buildCartBoard,
  needsCart,
  newRoundIds,
  NEXT_ORDER_STEP,
  ORDER_STATUS_LABEL,
  orderQueue,
  waitingFor,
  type CartTile,
  type OrderRow,
  type SessionRow,
} from "@/lib/staff/board";
import { fetchBoard, type BoardData } from "@/lib/staff/queries";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { timeIn } from "@/lib/time";
import {
  advanceOrder,
  assignCart,
  markOut,
  markReady,
  markReturned,
  rentWalkIn,
  setIgnoreHoursForDemo,
  setKitchenStatus,
  unassignCart,
  type BoardResult,
} from "./board-actions";

type Props = { initial: BoardData; timeZone: string; isAdmin: boolean };

export function StaffBoard({ initial, timeZone, isAdmin }: Props) {
  const [data, setData] = useState(initial);
  const [live, setLive] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [walkInCart, setWalkInCart] = useState<string | null>(null);
  const [, startRefresh] = useTransition();

  const supabase = useMemo(() => createBrowserSupabase(), []);
  // Rounds and orders already on screen; anything new chimes and flashes.
  const seen = useRef(
    new Set([...initial.rounds, ...initial.orders].map((r) => r.id)),
  );
  const soundRef = useRef(false);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  const clock = (iso: string | null) =>
    iso ? formatTime(timeIn(timeZone, new Date(iso))) : "—";

  const refresh = useCallback(() => {
    startRefresh(async () => {
      try {
        const next = await fetchBoard(supabase, timeZone);
        const fresh = newRoundIds(
          [...next.rounds, ...next.orders.filter((o) => o.status === "new")],
          seen.current,
        );
        for (const id of fresh) seen.current.add(id);
        if (fresh.length) {
          if (soundRef.current) chime();
          setFlash((prev) => new Set([...prev, ...fresh]));
          setTimeout(
            () =>
              setFlash(
                (prev) =>
                  new Set([...prev].filter((id) => !fresh.includes(id))),
              ),
            30_000,
          );
        }
        setData(next);
      } catch {
        setLive(false);
      }
    });
  }, [supabase, timeZone]);

  // Live updates from Supabase Realtime, plus a slow poll as a safety net.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    };
    const channel = supabase.channel("staff-board");
    for (const table of [
      "rounds",
      "cart_sessions",
      "carts",
      "orders",
      "settings",
    ]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        soon,
      );
    }
    channel.subscribe((status) => {
      setLive(status === "SUBSCRIBED");
      if (status === "SUBSCRIBED") soon();
    });
    const poll = setInterval(refresh, 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [supabase, refresh]);

  const board = useMemo(
    () => buildCartBoard(data.carts, data.sessions),
    [data],
  );
  const waiting = useMemo(() => needsCart(data.sessions), [data]);
  const free = availableCarts(board);
  const queue = useMemo(() => orderQueue(data.orders), [data]);

  // Re-render every 30s so "waiting 4 min" stays current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function run(key: string, action: () => Promise<BoardResult>) {
    setBusy(key);
    setMessage(null);
    const result = await action();
    if (!result.ok) setMessage(result.message);
    setBusy(null);
    refresh();
  }

  const dateLabel = new Date(`${data.today}T12:00:00Z`).toLocaleDateString(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-lg font-semibold">{dateLabel}</p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            live ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"
          }`}
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${live ? "bg-green-600" : "bg-amber-500"}`}
          />
          {live ? "Live" : "Reconnecting…"}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            if (next) chime(); // also unlocks audio on tablets
          }}
          aria-pressed={soundOn}
          className={`chip min-h-10 text-sm ${soundOn ? "chip-on" : ""}`}
        >
          {soundOn ? "Sound on" : "Tap to turn on sound"}
        </button>
        <KitchenToggle
          value={data.kitchen}
          busy={busy === "kitchen"}
          onChange={(status) => {
            // Show the change at once; the refresh after the action confirms
            // it (or puts it back if the save failed).
            setData((d) => ({ ...d, kitchen: status }));
            void run("kitchen", () => setKitchenStatus(status));
          }}
        />
        {data.kitchen !== data.kitchenDefault && (
          <span className="text-sm text-stone-600">
            Back to {kitchenLabels[data.kitchenDefault]} tomorrow
          </span>
        )}
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={data.ignoreHoursForDemo}
              disabled={busy === "demo"}
              onChange={(e) => {
                const on = e.target.checked;
                setData((d) => ({ ...d, ignoreHoursForDemo: on }));
                void run("demo", () => setIgnoreHoursForDemo(on));
              }}
              className="size-5 accent-green-800"
            />
            Demo: take orders outside hours
          </label>
        )}
        <button
          type="button"
          onClick={() => setWalkInCart(free[0]?.id ?? "")}
          disabled={free.length === 0}
          className="ml-auto rounded-lg bg-green-800 px-5 py-3 font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
        >
          Rent cart (walk-in)
        </button>
      </div>

      {message && (
        <p
          role="alert"
          className="rounded-lg bg-amber-50 px-4 py-3 text-amber-900"
        >
          {message}
        </p>
      )}

      {walkInCart !== null && (
        <WalkInForm
          carts={free}
          initialCartId={walkInCart}
          onCancel={() => setWalkInCart(null)}
          onSave={async (input) => {
            setBusy("walkin");
            const result = await rentWalkIn(input);
            setBusy(null);
            if (!result.ok) return result.message;
            setWalkInCart(null);
            refresh();
            return null;
          }}
          saving={busy === "walkin"}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1.5fr]">
        <section aria-labelledby="orders-heading">
          <h2 id="orders-heading" className="text-lg font-bold">
            Orders {queue.length > 0 && <Count n={queue.length} />}
          </h2>
          {queue.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">No orders waiting.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {queue.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  waited={waitingFor(o.created_at, new Date(now))}
                  flash={flash.has(o.id)}
                  busy={busy === o.id}
                  onNext={() =>
                    run(o.id, () =>
                      advanceOrder(o.id, NEXT_ORDER_STEP[o.status].to),
                    )
                  }
                />
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section aria-labelledby="needs-heading">
            <h2 id="needs-heading" className="text-lg font-bold">
              Needs a cart {waiting.length > 0 && <Count n={waiting.length} />}
            </h2>
            {waiting.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">
                No online reservations waiting.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {waiting.map((s) => (
                  <NeedsCartRow
                    key={s.id}
                    session={s}
                    arrive={clock(s.reserved_for)}
                    carts={free}
                    busy={busy === s.id}
                    onAssign={(cartId) =>
                      run(s.id, () => assignCart(s.id, cartId))
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="paid-heading">
            <h2 id="paid-heading" className="text-lg font-bold">
              Paid today{" "}
              {data.rounds.length > 0 && <Count n={data.rounds.length} />}
            </h2>
            {data.rounds.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">
                No online payments yet today.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {data.rounds.map((r) => (
                  <li
                    key={r.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      flash.has(r.id)
                        ? "border-green-600 bg-green-50"
                        : "border-stone-200 bg-white"
                    }`}
                  >
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{r.name}</span>
                      <span className="font-mono text-sm text-stone-500">
                        {r.code}
                      </span>
                    </p>
                    <p className="text-sm text-stone-700">
                      {r.players} player{r.players === 1 ? "" : "s"} · {r.holes}{" "}
                      holes ·{" "}
                      {r.carts
                        ? `${r.carts} cart${r.carts === 1 ? "" : "s"}`
                        : "no cart"}
                    </p>
                    <p className="text-sm text-stone-500">
                      Arriving {r.arrival_time ?? clock(r.arrive_at)} ·{" "}
                      {formatPrice(r.amount_cents)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section aria-labelledby="carts-heading">
          <h2 id="carts-heading" className="text-lg font-bold">
            Carts{" "}
            <span className="text-sm font-normal text-stone-500">
              {free.length} available
            </span>
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {board.map((tile) => (
              <CartCard
                key={tile.cart.id}
                tile={tile}
                clock={clock}
                busy={
                  tile.state.kind !== "available" &&
                  busy === tile.state.session.id
                }
                onRent={() => setWalkInCart(tile.cart.id)}
                onStep={(action, id) =>
                  run(id, () =>
                    ({
                      ready: markReady,
                      out: markOut,
                      returned: markReturned,
                      unassign: unassignCart,
                    })[action](id),
                  )
                }
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

const ORDER_STYLE = {
  new: "border-red-400 bg-red-50",
  preparing: "border-amber-300 bg-amber-50",
  out_for_delivery: "border-green-700 bg-green-50",
} as const;

function OrderCard({
  order,
  waited,
  flash,
  busy,
  onNext,
}: {
  order: OrderRow;
  waited: string;
  flash: boolean;
  busy: boolean;
  onNext: () => void;
}) {
  const step = NEXT_ORDER_STEP[order.status];
  return (
    <li
      className={`rounded-xl border-2 p-3 ${ORDER_STYLE[order.status]} ${
        flash ? "ring-4 ring-red-300" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl leading-none font-bold">Hole {order.hole}</p>
          <p className="mt-1 font-semibold">{order.name}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold uppercase">
            {ORDER_STATUS_LABEL[order.status]}
          </p>
          <p className="text-stone-600">{waited}</p>
          <p className="font-mono text-stone-500">{order.code}</p>
        </div>
      </div>
      {order.has_alcohol && (
        <p className="mt-2 inline-block rounded bg-amber-200 px-2 py-0.5 text-sm font-bold text-amber-950">
          21+ CHECK ID
        </p>
      )}
      <ul className="mt-2 text-sm">
        {order.items.map((line) => (
          <li key={line.id}>
            <span className="font-semibold">{line.qty}×</span> {line.name}
            {line.is_alcohol && <span className="text-amber-800"> (21+)</span>}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2">
        <a
          href={`tel:${order.phone.replace(/\D/g, "")}`}
          className="text-sm text-stone-600 underline"
        >
          {order.phone}
        </a>
        <Btn primary disabled={busy} onClick={onNext}>
          {step.label}
        </Btn>
      </div>
    </li>
  );
}

const KITCHEN_OPTIONS = [
  { value: "open", label: "Kitchen open" },
  { value: "drinks_only", label: "Drinks only" },
  { value: "closed", label: "Ordering closed" },
] as const;

function KitchenToggle({
  value,
  busy,
  onChange,
}: {
  value: BoardData["kitchen"];
  busy: boolean;
  onChange: (status: BoardData["kitchen"]) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Ordering to the course"
      className="flex overflow-hidden rounded-lg border border-stone-300"
    >
      {KITCHEN_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={busy}
          onClick={() => value !== o.value && onChange(o.value)}
          className={`min-h-10 px-3 text-sm font-semibold ${
            value === o.value
              ? o.value === "closed"
                ? "bg-stone-700 text-white"
                : "bg-green-800 text-white"
              : "bg-white hover:bg-stone-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const STYLE = {
  available: "border-stone-200 bg-white",
  reserved: "border-sky-300 bg-sky-50",
  ready: "border-amber-300 bg-amber-50",
  out: "border-green-700 bg-green-50",
} as const;

const LABEL = {
  available: "Available",
  reserved: "Reserved",
  ready: "Ready",
  out: "Out",
} as const;

type Step = "ready" | "out" | "returned" | "unassign";

function CartCard({
  tile,
  clock,
  busy,
  onRent,
  onStep,
}: {
  tile: CartTile;
  clock: (iso: string | null) => string;
  busy: boolean;
  onRent: () => void;
  onStep: (step: Step, sessionId: string) => void;
}) {
  const { cart, state } = tile;
  const s = state.kind === "available" ? null : state.session;

  return (
    <li
      className={`flex flex-col rounded-xl border-2 p-3 ${STYLE[state.kind]}`}
    >
      <p className="flex items-baseline justify-between">
        <span className="text-3xl font-bold tabular-nums">#{cart.number}</span>
        <span className="text-sm font-semibold tracking-wide uppercase">
          {LABEL[state.kind]}
        </span>
      </p>
      {s ? (
        <div className="mt-1 text-sm">
          <p className="truncate font-semibold">{s.name}</p>
          <p className="text-stone-600">
            {s.holes} holes ·{" "}
            {state.kind === "out"
              ? `since ${clock(s.out_at)}`
              : `arriving ${clock(s.reserved_for)}`}
            {s.source === "walkin" && " · walk-in"}
          </p>
        </div>
      ) : (
        <p className="mt-1 text-sm text-stone-500">Ready to rent</p>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        {state.kind === "available" && <Btn onClick={onRent}>Rent</Btn>}
        {state.kind === "reserved" && s && (
          <>
            <Btn primary disabled={busy} onClick={() => onStep("ready", s.id)}>
              Ready
            </Btn>
            <Btn disabled={busy} onClick={() => onStep("unassign", s.id)}>
              Unassign
            </Btn>
          </>
        )}
        {state.kind === "ready" && s && (
          <>
            <Btn primary disabled={busy} onClick={() => onStep("out", s.id)}>
              Out
            </Btn>
            <Btn disabled={busy} onClick={() => onStep("unassign", s.id)}>
              Unassign
            </Btn>
          </>
        )}
        {state.kind === "out" && s && (
          <Btn primary disabled={busy} onClick={() => onStep("returned", s.id)}>
            Returned
          </Btn>
        )}
      </div>
    </li>
  );
}

function NeedsCartRow({
  session,
  arrive,
  carts,
  busy,
  onAssign,
}: {
  session: SessionRow;
  arrive: string;
  carts: { id: string; number: number }[];
  busy: boolean;
  onAssign: (cartId: string) => void;
}) {
  const [cartId, setCartId] = useState("");
  const chosen = cartId || carts[0]?.id || "";
  return (
    <li className="rounded-lg border border-sky-300 bg-sky-50 p-3">
      <p className="font-semibold">{session.name}</p>
      <p className="text-sm text-stone-600">
        {session.holes} holes · arriving {arrive}
      </p>
      {carts.length === 0 ? (
        <p className="mt-2 text-sm text-amber-900">No carts free right now.</p>
      ) : (
        <div className="mt-2 flex gap-2">
          <select
            aria-label={`Cart for ${session.name}`}
            value={chosen}
            onChange={(e) => setCartId(e.target.value)}
            className="input py-2"
          >
            {carts.map((c) => (
              <option key={c.id} value={c.id}>
                Cart #{c.number}
              </option>
            ))}
          </select>
          <Btn
            primary
            disabled={busy || !chosen}
            onClick={() => onAssign(chosen)}
          >
            Assign
          </Btn>
        </div>
      )}
    </li>
  );
}

function WalkInForm({
  carts,
  initialCartId,
  onCancel,
  onSave,
  saving,
}: {
  carts: { id: string; number: number }[];
  initialCartId: string;
  onCancel: () => void;
  onSave: (input: {
    name: string;
    cartId: string;
    holes: number;
  }) => Promise<string | null>;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [cartId, setCartId] = useState(initialCartId || carts[0]?.id || "");
  const [holes, setHoles] = useState<9 | 18>(9);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(await onSave({ name, cartId, holes }));
      }}
      className="rounded-xl border-2 border-green-800 bg-white p-4"
      aria-label="Rent a cart to a walk-in"
    >
      <h2 className="text-lg font-bold">Rent cart (walk-in)</h2>
      <p className="text-sm text-stone-600">
        Take payment at the register as usual.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Cart</span>
          <select
            value={cartId}
            onChange={(e) => setCartId(e.target.value)}
            className="input"
          >
            {carts.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.number}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Holes">
          <span className="mb-1 block text-sm font-medium">Holes</span>
          <div className="flex gap-2">
            {([9, 18] as const).map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={holes === h}
                onClick={() => setHoles(h)}
                className={`chip ${holes === h ? "chip-on" : ""}`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-green-800 px-5 py-3 font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
        >
          {saving ? "Saving…" : "Cart is out"}
        </button>
        <Btn onClick={onCancel}>Cancel</Btn>
      </div>
    </form>
  );
}

function Btn({
  children,
  primary,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-11 rounded-lg px-4 font-semibold disabled:opacity-50 ${
        primary
          ? "bg-green-800 text-white hover:bg-green-900"
          : "border border-stone-300 bg-white hover:border-green-700"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1 rounded-full bg-stone-200 px-2 py-0.5 text-sm font-semibold">
      {n}
    </span>
  );
}

/** Two short tones. Created on demand; tablets need a tap first (the sound toggle). */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    // No audio available; the green highlight still shows new payments.
  }
}
