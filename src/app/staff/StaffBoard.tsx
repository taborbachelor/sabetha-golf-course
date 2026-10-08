"use client";

import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import type { Holes } from "@/content/settings";
import { formatPrice } from "@/content/menu";
import { kitchenLabels } from "@/lib/orders/kitchen";
import {
  availableCarts,
  boardClock,
  buildCartBoard,
  hasStaleNewOrder,
  heldForOnline,
  LATE_ORDER_MINUTES,
  minutesSince,
  needsCart,
  newRoundIds,
  NEXT_ORDER_STEP,
  ORDER_STATUS_LABEL,
  orderQueue,
  partyCartLabels,
  rowSignatures,
  sinceBeforeToday,
  waitingFor,
  type CartTile,
  type OrderRow,
  type SessionRow,
} from "@/lib/staff/board";
import { fetchBoard, type BoardData } from "@/lib/staff/queries";
import { createBrowserSupabase } from "@/lib/supabase/browser";
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
  undoDelivered,
  undoReturned,
  type BoardResult,
} from "./board-actions";

type Props = {
  initial: BoardData;
  timeZone: string;
  roundMinutes: Record<Holes, number>;
  isAdmin: boolean;
};

const LOGIN = "/staff/login?next=/staff";
const SAVE_FAILED = "Couldn't save. Check Wi-Fi and tap again.";
/** A save that hangs this long counts as failed, so no button stays stuck. */
const ACTION_TIMEOUT_MS = 15_000;
const MESSAGE_MS = 8_000;
const UNDO_MS = 10_000;
/** After the board shows a row's new status, its buttons wait this long. */
const SETTLE_MS = 1_000;
/** A row never stays locked longer than this, even if refreshes fail. */
const LOCK_MAX_MS = 15_000;
/** No "Not updating" bar while the first connection is being made. */
const STARTUP_GRACE_MS = 5_000;

/** A tapped row: locked until the board shows it changed (see rowSignatures). */
type Lock = { sig: string | undefined; inFlight: boolean };
type Notice = { id: number; text: string };
type Undo = { id: number; label: string; run: () => Promise<BoardResult> };

export function StaffBoard({
  initial,
  timeZone,
  roundMinutes,
  isAdmin,
}: Props) {
  const [data, setData] = useState(initial);
  const [fetchOk, setFetchOk] = useState(true);
  const [channelOk, setChannelOk] = useState(false);
  const [channelGen, setChannelGen] = useState(0);
  const [graceOver, setGraceOver] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [locks, setLocks] = useState<Record<string, Lock>>({});
  const [walkInCart, setWalkInCart] = useState<string | null>(null);
  const [walkInSaving, setWalkInSaving] = useState(false);
  const [, startRefresh] = useTransition();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const live = fetchOk && channelOk && online;

  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  // Rounds and orders already on screen; anything new chimes and flashes.
  const seen = useRef(
    new Set([...initial.rounds, ...initial.orders].map((r) => r.id)),
  );
  const soundRef = useRef(false);
  const channelOkRef = useRef(false);
  const ordersRef = useRef(initial.orders);
  const inFlight = useRef(new Set<string>());
  const refreshSeq = useRef(0);
  const noticeSeq = useRef(0);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);
  useEffect(() => {
    ordersRef.current = data.orders;
  }, [data.orders]);

  const clock = (iso: string | null) => boardClock(iso, data.today, timeZone);

  const say = useCallback((text: string) => {
    setNotice({ id: ++noticeSeq.current, text });
  }, []);

  const refresh = useCallback(() => {
    const seq = ++refreshSeq.current;
    startRefresh(async () => {
      try {
        // Signed out on another tab, or the session expired: without this
        // the board would quietly go empty (RLS hides everything).
        const { data: auth } = await supabase.auth.getSession();
        if (!auth.session) {
          router.replace(LOGIN);
          return;
        }
        const next = await fetchBoard(supabase, timeZone);
        // An older refresh finishing late must not overwrite a newer one.
        if (seq !== refreshSeq.current) return;
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
        setFetchOk(true);
      } catch {
        if (seq === refreshSeq.current) setFetchOk(false);
      }
    });
  }, [supabase, timeZone, router]);

  // Live updates from Supabase Realtime, plus a slow poll as a safety net.
  // A tablet that slept or lost Wi-Fi catches up as soon as it's back, and
  // reconnects Realtime if the channel didn't come back on its own.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 250);
    };
    const channel = supabase.channel(`staff-board-${channelGen}`);
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
      const ok = status === "SUBSCRIBED";
      channelOkRef.current = ok;
      setChannelOk(ok);
      if (ok) soon();
    });
    const catchUp = () => {
      refresh();
      if (!channelOkRef.current) setChannelGen((g) => g + 1);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      catchUp();
      recheckAudio(() => setSoundOn(false));
    };
    const poll = setInterval(refresh, 60_000);
    window.addEventListener("online", catchUp);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("online", catchUp);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [supabase, refresh, channelGen]);

  useEffect(() => {
    const id = setTimeout(() => setGraceOver(true), STARTUP_GRACE_MS);
    return () => clearTimeout(id);
  }, []);

  // Re-chime while an order sits in New: easy to miss one chime at a rush.
  useEffect(() => {
    const id = setInterval(() => {
      if (soundRef.current && hasStaleNewOrder(ordersRef.current)) chime();
    }, 120_000);
    return () => clearInterval(id);
  }, []);

  // Messages and Undo clear themselves.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(
      () => setNotice((n) => (n?.id === notice.id ? null : n)),
      MESSAGE_MS,
    );
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!undo) return;
    const id = setTimeout(
      () => setUndo((u) => (u?.id === undo.id ? null : u)),
      UNDO_MS,
    );
    return () => clearTimeout(id);
  }, [undo]);

  const board = useMemo(
    () => buildCartBoard(data.carts, data.sessions),
    [data],
  );
  const waiting = useMemo(
    () =>
      needsCart(data.sessions, {
        today: data.today,
        timeZone,
        paidRoundIds: new Set(data.rounds.map((r) => r.id)),
      }),
    [data, timeZone],
  );
  const party = useMemo(
    () => partyCartLabels(data.sessions, data.rounds),
    [data],
  );
  const sigs = useMemo(() => rowSignatures(data.sessions, data.orders), [data]);
  const free = availableCarts(board);
  const queue = useMemo(() => orderQueue(data.orders), [data]);

  // Re-render every 30s so "waiting 4 min" stays current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const heldNow = heldForOnline(waiting, roundMinutes[18], new Date(now));

  const release = useCallback((key: string, lock: Lock) => {
    setLocks((prev) => {
      if (prev[key] !== lock) return prev;
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
  }, []);

  // Unlock a row shortly after the board shows its new status.
  useEffect(() => {
    const timers = Object.entries(locks)
      .filter(([key, lock]) => !lock.inFlight && sigs.get(key) !== lock.sig)
      .map(([key, lock]) => setTimeout(() => release(key, lock), SETTLE_MS));
    return () => timers.forEach(clearTimeout);
  }, [locks, sigs, release]);

  const locked = (key: string) => key in locks;

  /** Network trouble, or a session that has expired? The latter goes to sign in. */
  async function failed(): Promise<string> {
    let signedOut = false;
    try {
      const { data: auth, error } = await supabase.auth.getUser();
      signedOut = !auth.user && !isAuthRetryableFetchError(error);
    } catch {
      // Can't tell; treat it as a network problem.
    }
    if (signedOut) router.replace(LOGIN);
    return SAVE_FAILED;
  }

  /**
   * Every tablet action goes through here: lock the row, save, report
   * failures where staff are looking, refresh. Never leaves a button stuck.
   */
  async function run(
    key: string,
    action: () => Promise<BoardResult>,
    onDone?: (at: string | undefined) => void,
  ) {
    if (inFlight.current.has(key) || locked(key)) return;
    inFlight.current.add(key);
    const lock: Lock = { sig: sigs.get(key), inFlight: true };
    setLocks((prev) => ({ ...prev, [key]: lock }));
    let ok = false;
    try {
      const result = await withTimeout(action(), ACTION_TIMEOUT_MS);
      if (result.ok) {
        ok = true;
        onDone?.(result.at);
      } else {
        say(result.message);
      }
    } catch {
      say(await failed());
    } finally {
      inFlight.current.delete(key);
      if (ok && lock.sig !== undefined) {
        // Keep the row locked until refreshed data shows the change.
        const waitForData: Lock = { ...lock, inFlight: false };
        setLocks((prev) =>
          prev[key] === lock ? { ...prev, [key]: waitForData } : prev,
        );
        setTimeout(() => release(key, waitForData), LOCK_MAX_MS);
      } else {
        release(key, lock);
      }
      refresh();
    }
  }

  function offerUndo(label: string, undoIt: () => Promise<BoardResult>) {
    setUndo({ id: ++noticeSeq.current, label, run: undoIt });
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

  const showNotLive = !live && (graceOver || !online);
  const cartSummary = `${free.length} free${
    heldNow > 0 ? ` · ${heldNow} held for online` : ""
  }`;

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
          {live ? "Live" : "Not live"}
        </span>
        {soundOn && (
          <button
            type="button"
            onClick={() => setSoundOn(false)}
            aria-pressed
            className="chip chip-on min-h-10 text-sm"
          >
            Sound on
          </button>
        )}
        <KitchenToggle
          value={data.kitchen}
          busy={locked("kitchen")}
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
              disabled={locked("demo")}
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
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm font-semibold text-stone-700">
            {cartSummary}
          </span>
          <button
            type="button"
            onClick={() => setWalkInCart(free[0]?.id ?? "")}
            disabled={free.length === 0}
            className="rounded-lg bg-green-800 px-5 py-3 font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
          >
            Rent cart (walk-in)
          </button>
        </div>
      </div>

      {walkInCart !== null && (
        <WalkInForm
          carts={free}
          initialCartId={walkInCart}
          heldFor={(holes) =>
            heldForOnline(waiting, roundMinutes[holes], new Date())
          }
          onCancel={() => setWalkInCart(null)}
          onSave={async (input) => {
            if (inFlight.current.has("walkin")) return null;
            inFlight.current.add("walkin");
            setWalkInSaving(true);
            try {
              const result = await withTimeout(
                rentWalkIn(input),
                ACTION_TIMEOUT_MS,
              );
              if (!result.ok) return result.message;
              setWalkInCart(null);
              return null;
            } catch {
              return await failed();
            } finally {
              inFlight.current.delete("walkin");
              setWalkInSaving(false);
              refresh();
            }
          }}
          saving={walkInSaving}
        />
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[1fr_1.6fr_0.9fr]">
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
                  late={
                    minutesSince(o.created_at, new Date(now)) >=
                    LATE_ORDER_MINUTES
                  }
                  flash={flash.has(o.id)}
                  busy={locked(o.id)}
                  onNext={() => {
                    const to = NEXT_ORDER_STEP[o.status].to;
                    void run(
                      o.id,
                      () => advanceOrder(o.id, to),
                      (at) =>
                        to === "delivered" &&
                        at &&
                        offerUndo(`Hole ${o.hole} delivered (${o.name})`, () =>
                          undoDelivered(o.id, at),
                        ),
                    );
                  }}
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
                    party={party.get(s.id)}
                    carts={free}
                    busy={locked(s.id)}
                    onAssign={(cartId) =>
                      void run(s.id, () => assignCart(s.id, cartId))
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="carts-heading">
            <h2 id="carts-heading" className="text-lg font-bold">
              Carts{" "}
              <span className="text-sm font-normal text-stone-600">
                {cartSummary}
              </span>
            </h2>
            <ul className="mt-2 grid grid-cols-2 gap-3 xl:grid-cols-3">
              {board.map((tile) => (
                <CartCard
                  key={tile.cart.id}
                  tile={tile}
                  clock={clock}
                  overnight={
                    tile.state.kind !== "available" &&
                    sinceBeforeToday(
                      tile.state.kind === "out"
                        ? (tile.state.session.out_at ??
                            tile.state.session.reserved_for)
                        : tile.state.session.reserved_for,
                      data.today,
                      timeZone,
                    )
                  }
                  party={
                    tile.state.kind === "available"
                      ? undefined
                      : party.get(tile.state.session.id)
                  }
                  busy={
                    tile.state.kind !== "available" &&
                    locked(tile.state.session.id)
                  }
                  onRent={() => setWalkInCart(tile.cart.id)}
                  onStep={(step, id) =>
                    void run(
                      id,
                      () =>
                        ({
                          ready: markReady,
                          out: markOut,
                          returned: markReturned,
                          unassign: unassignCart,
                        })[step](id),
                      (at) =>
                        step === "returned" &&
                        at &&
                        offerUndo(`Cart #${tile.cart.number} returned`, () =>
                          undoReturned(id, at),
                        ),
                    )
                  }
                />
              ))}
            </ul>
          </section>
        </div>

        <section
          aria-labelledby="paid-heading"
          className="md:col-span-2 lg:col-span-1"
        >
          <h2 id="paid-heading" className="text-lg font-bold">
            Paid today{" "}
            {data.rounds.length > 0 && <Count n={data.rounds.length} />}
          </h2>
          {data.rounds.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">
              No online payments yet today.
            </p>
          ) : (
            <ul className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-1">
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

      {/* Room to scroll the last cards above the bars at the bottom. */}
      <div aria-hidden="true" className="h-40" />

      {/* Fixed at the bottom so they show wherever staff have scrolled to. */}
      <div className="fixed inset-x-0 bottom-0 z-30 print:hidden">
        <div className="mx-auto max-w-3xl space-y-2 px-4 pb-3">
          {undo && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-xl bg-stone-900 px-5 py-3 text-lg text-white shadow-lg"
            >
              <span className="font-semibold">{undo.label}</span>
              <button
                type="button"
                onClick={() => {
                  const it = undo;
                  setUndo(null);
                  void run("undo", it.run);
                }}
                className="min-h-11 rounded-lg bg-white px-5 font-bold text-stone-900"
              >
                Undo
              </button>
            </div>
          )}
          {notice && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl bg-amber-100 px-5 py-3 text-lg font-semibold text-amber-950 shadow-lg ring-2 ring-amber-400"
            >
              <span>{notice.text}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="min-h-11 rounded-lg border border-amber-500 bg-white px-4 font-semibold"
              >
                OK
              </button>
            </div>
          )}
        </div>
        {showNotLive && (
          <p
            role="status"
            className="bg-amber-500 px-4 py-4 text-center text-2xl font-bold text-stone-950"
          >
            Not updating. Check Wi-Fi.
          </p>
        )}
        {!soundOn && (
          <button
            type="button"
            onClick={() => {
              if (unlockAudio()) {
                setSoundOn(true);
                chime();
              } else {
                say("This device can't play sound.");
              }
            }}
            className="block w-full bg-amber-300 px-4 py-4 text-center text-xl font-bold text-stone-950 hover:bg-amber-200"
          >
            Sound is OFF. Tap here so you hear new orders.
          </button>
        )}
      </div>
    </div>
  );
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });
}

const ORDER_STYLE = {
  new: "border-red-400 bg-red-50",
  preparing: "border-amber-300 bg-amber-50",
  out_for_delivery: "border-green-700 bg-green-50",
} as const;

function OrderCard({
  order,
  waited,
  late,
  flash,
  busy,
  onNext,
}: {
  order: OrderRow;
  waited: string;
  late: boolean;
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
          <p
            className={
              late ? "text-base font-bold text-red-700" : "text-stone-600"
            }
          >
            {waited}
          </p>
          <p className="font-mono text-stone-500">{order.code}</p>
        </div>
      </div>
      {order.has_alcohol && (
        <p className="mt-2 inline-block rounded bg-amber-200 px-2 py-0.5 text-sm font-bold text-amber-950">
          21+ CHECK ID
        </p>
      )}
      <ul className="mt-2 space-y-0.5 text-lg leading-snug">
        {order.items.map((line) => (
          <li key={line.id}>
            <span className="font-extrabold">{line.qty}×</span> {line.name}
            {line.is_alcohol && (
              <span className="text-base text-amber-800"> (21+)</span>
            )}
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
    // Gaps between the buttons so a wet thumb doesn't hit the neighbour.
    <div
      role="group"
      aria-label="Ordering to the course"
      className="flex gap-2"
    >
      {KITCHEN_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={busy}
          onClick={() => value !== o.value && onChange(o.value)}
          className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${
            value === o.value
              ? o.value === "closed"
                ? "border-stone-700 bg-stone-700 text-white"
                : "border-green-800 bg-green-800 text-white"
              : "border-stone-300 bg-white hover:bg-stone-50"
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
  overnight,
  party,
  busy,
  onRent,
  onStep,
}: {
  tile: CartTile;
  clock: (iso: string | null) => string;
  /** Out (or held) since a previous day: needs sorting out. */
  overnight: boolean;
  party: string | undefined;
  busy: boolean;
  onRent: () => void;
  onStep: (step: Step, sessionId: string) => void;
}) {
  const { cart, state } = tile;
  const s = state.kind === "available" ? null : state.session;

  return (
    <li
      className={`flex flex-col rounded-xl border-2 p-3 ${
        overnight ? "border-red-600 bg-red-50" : STYLE[state.kind]
      }`}
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
          {party && <p className="font-semibold text-sky-900">{party}</p>}
          <p
            className={overnight ? "font-bold text-red-800" : "text-stone-600"}
          >
            {s.holes} holes ·{" "}
            {state.kind === "out"
              ? `since ${clock(s.out_at ?? s.reserved_for)}`
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
  party,
  carts,
  busy,
  onAssign,
}: {
  session: SessionRow;
  arrive: string;
  party: string | undefined;
  carts: { id: string; number: number }[];
  busy: boolean;
  onAssign: (cartId: string) => void;
}) {
  const [cartId, setCartId] = useState("");
  // The picked cart may have been taken meanwhile: fall back to a free one.
  const chosen = carts.some((c) => c.id === cartId)
    ? cartId
    : (carts[0]?.id ?? "");
  return (
    <li className="rounded-lg border border-sky-300 bg-sky-50 p-3">
      <p className="font-semibold">
        {session.name}
        {party && <span className="text-sky-900"> · {party}</span>}
      </p>
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
  heldFor,
  onCancel,
  onSave,
  saving,
}: {
  carts: { id: string; number: number }[];
  initialCartId: string;
  /** Online reservations still needing a free cart, for a rental of `holes`. */
  heldFor: (holes: Holes) => number;
  onCancel: () => void;
  onSave: (input: {
    name: string;
    cartId: string;
    holes: number;
  }) => Promise<string | null>;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState(initialCartId);
  const [holes, setHoles] = useState<Holes>(9);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // The cart picked (or tapped on a tile) may have gone meanwhile.
  const cartId = carts.some((c) => c.id === picked)
    ? picked
    : (carts[0]?.id ?? "");
  const held = heldFor(holes);

  // Opened from a cart tile far down the page (portrait): bring it into view.
  useEffect(() => {
    formRef.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError("Enter the golfer's name.");
          return;
        }
        if (!cartId) {
          setError("No carts free right now.");
          return;
        }
        setError(await onSave({ name: name.trim(), cartId, holes }));
      }}
      className="rounded-xl border-2 border-green-800 bg-white p-4"
      aria-label="Rent a cart to a walk-in"
    >
      <h2 className="text-lg font-bold">Rent cart (walk-in)</h2>
      <p className="text-sm text-stone-600">
        Take payment at the register as usual.
      </p>
      {held > 0 && carts.length <= held && (
        <p
          role="note"
          className="mt-3 rounded-lg bg-amber-100 px-3 py-2 font-semibold text-amber-950"
        >
          Heads-up: {held} cart{held === 1 ? " is" : "s are"} already paid for
          online and still waiting to be assigned, and only {carts.length}{" "}
          {carts.length === 1 ? "cart is" : "carts are"} free.
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            aria-invalid={error !== null && !name.trim()}
            className="input"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Cart</span>
          <select
            value={cartId}
            onChange={(e) => setPicked(e.target.value)}
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
        <p role="alert" className="mt-3 font-semibold text-red-700">
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

/**
 * One AudioContext for the whole page. iPad Safari only lets a context play
 * if it was created or resumed inside a tap, so unlockAudio() runs from the
 * "Sound is OFF" button and every later chime reuses that context.
 */
let audio: AudioContext | null = null;

function unlockAudio(): boolean {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    return true;
  } catch {
    return false;
  }
}

/** After the tablet wakes: if the system suspended audio, ask for a tap again. */
function recheckAudio(onLost: () => void) {
  const ctx = audio;
  if (!ctx || ctx.state === "running") return;
  ctx
    .resume()
    .catch(() => {})
    .finally(() => {
      if (ctx.state !== "running") onLost();
    });
}

/** Two short tones on the shared context. */
function chime() {
  const ctx = audio;
  if (!ctx) return;
  try {
    if (ctx.state !== "running") void ctx.resume();
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
  } catch {
    // No audio available; the highlight still shows new payments and orders.
  }
}
