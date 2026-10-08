"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef } from "react";
import type { PricesHours } from "@/lib/settings/form";
import { useUnsavedChanges } from "../useUnsavedChanges";
import { saveSettings, type SaveState } from "./actions";
import { focusField } from "./focusField";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function SettingsForm({ values }: { values: PricesHours }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(
    saveSettings,
    {},
  );
  const { onChange } = useUnsavedChanges(state);
  const form = useRef<HTMLFormElement>(null);
  const errorFor = (key: string) =>
    state.key === key ? state.message : undefined;

  // Take the admin to the box that needs fixing.
  useEffect(() => {
    if (state.field && form.current) focusField(form.current, state.field);
  }, [state]);

  return (
    <form
      ref={form}
      onChange={onChange}
      // Submitted by hand so React doesn't reset the fields: a failed save
      // keeps the admin's edits on screen.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      noValidate
      className="space-y-8"
    >
      <Section
        title="Green fees"
        hint="Per player. Weekend = Saturday and Sunday."
        error={errorFor("green_fees")}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Money
            name="green_fees.weekday.9"
            label="Weekday 9"
            value={values.green_fees.weekday[9]}
          />
          <Money
            name="green_fees.weekday.18"
            label="Weekday 18"
            value={values.green_fees.weekday[18]}
          />
          <Money
            name="green_fees.weekend.9"
            label="Weekend 9"
            value={values.green_fees.weekend[9]}
          />
          <Money
            name="green_fees.weekend.18"
            label="Weekend 18"
            value={values.green_fees.weekend[18]}
          />
        </div>
      </Section>

      <Section
        title="Cart rental"
        hint="Per cart."
        error={errorFor("cart_rental")}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Money
            name="cart_rental.9"
            label="9 holes"
            value={values.cart_rental[9]}
          />
          <Money
            name="cart_rental.18"
            label="18 holes"
            value={values.cart_rental[18]}
          />
        </div>
      </Section>

      <Section
        title="Clubhouse hours"
        hint="Also controls when Order to the Course takes orders."
        error={errorFor("clubhouse_hours")}
      >
        <div className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {DAYS.map((day, i) => (
            <DayRow
              key={day}
              day={day}
              index={i}
              hours={values.clubhouse_hours[i]}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Pay to Play"
        error={errorFor("book_ahead_days") ?? errorFor("round_minutes")}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField
            name="book_ahead_days"
            label="Days ahead golfers can pay"
            value={values.book_ahead_days}
          />
          <NumberField
            name="round_minutes.9"
            label="Cart held for 9 holes (min)"
            value={values.round_minutes[9]}
          />
          <NumberField
            name="round_minutes.18"
            label="Cart held for 18 holes (min)"
            value={values.round_minutes[18]}
          />
        </div>
      </Section>

      <Section title="Pool" error={errorFor("pool_guest_fee")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Money
            name="pool_guest_fee"
            label="Guest swim fee"
            value={values.pool_guest_fee}
          />
        </div>
      </Section>

      <Section title="Clubhouse rental" error={errorFor("clubhouse_rental")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Money
            name="clubhouse_rental.cleanupDeposit"
            label="Cleanup deposit"
            value={values.clubhouse_rental.cleanupDeposit}
          />
          <Money
            name="clubhouse_rental.selfCleanRefund"
            label="Refund if renter cleans"
            value={values.clubhouse_rental.selfCleanRefund}
          />
          <Money
            name="clubhouse_rental.outsideCateringFee"
            label="Outside catering fee"
            value={values.clubhouse_rental.outsideCateringFee}
          />
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 space-y-3 border-t border-stone-200 bg-[var(--background)] px-4 py-4">
        {state.message && (
          <p
            role={state.ok ? "status" : "alert"}
            className={`rounded-lg px-4 py-3 ${state.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800"}`}
          >
            {state.message}
            {state.signsStale && (
              <span className="mt-1 block">
                The hole #1 sign shows these prices — reprint it from{" "}
                <Link
                  href="/admin/signs?sheet=hole1"
                  className="font-medium underline"
                >
                  QR signs
                </Link>
                .
              </span>
            )}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900 disabled:bg-stone-400 sm:w-auto"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  hint,
  error,
  children,
}: {
  title: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-lg font-bold">{title}</legend>
      {hint && <p className="mb-2 text-sm text-stone-600">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </fieldset>
  );
}

function NumberField({
  name,
  label,
  value,
  prefix,
}: {
  name: string;
  label: string;
  value: number;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <span className="flex items-center gap-1">
        {prefix && <span className="text-stone-600">{prefix}</span>}
        <input
          name={name}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          defaultValue={value}
          className="input"
        />
      </span>
    </label>
  );
}

function Money(props: { name: string; label: string; value: number }) {
  return <NumberField {...props} prefix="$" />;
}

function DayRow({
  day,
  index,
  hours,
}: {
  day: string;
  index: number;
  hours: { open: string; close: string } | null;
}) {
  return (
    <div className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 has-checked:bg-stone-50">
      <span className="w-24 font-medium">{day}</span>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name={`hours.${index}.closed`}
          defaultChecked={hours === null}
          className="size-5 accent-green-800"
        />
        Closed
      </label>
      <span className="flex items-center gap-2 group-has-checked:opacity-40">
        <input
          type="time"
          name={`hours.${index}.open`}
          aria-label={`${day} opens`}
          defaultValue={hours?.open ?? "11:00"}
          className="input w-36 py-2"
        />
        <span aria-hidden="true">to</span>
        <input
          type="time"
          name={`hours.${index}.close`}
          aria-label={`${day} closes`}
          defaultValue={hours?.close ?? "20:00"}
          className="input w-36 py-2"
        />
      </span>
    </div>
  );
}
