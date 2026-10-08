"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FieldError } from "@/components/FieldError";
import { errorId, errorsByField, focusFirstInvalid } from "@/lib/forms";
import {
  applicationFromForm,
  applicationSchema,
  type Application,
} from "@/lib/memberships/application";
import { submitApplication, type ApplyState } from "./actions";

export type TierOption = {
  id: string;
  name: string;
  notes: string | null;
  isSample: boolean;
};

type Errors = Partial<Record<keyof Application, string>>;

export function ApplyForm({ tiers }: { tiers: TierOption[] }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(
    submitApplication,
    {},
  );
  const v = state.values;
  // React resets the form after each submit; the key remounts the fields so
  // their defaultValues come back from the echoed values.
  const formKey = JSON.stringify(v ?? {});

  // Every field's error at once. Checked in the browser before sending; the
  // server checks again and its answer replaces these.
  const [errors, setErrors] = useState<Errors>({});
  const [focusTick, setFocusTick] = useState(0);
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setErrors(state.field ? { [state.field]: state.error } : {});
    if (state.field) setFocusTick((n) => n + 1);
  }

  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (focusTick) focusFirstInvalid(formRef.current);
  }, [focusTick]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const parsed = applicationSchema.safeParse(
      applicationFromForm(new FormData(e.currentTarget)),
    );
    if (parsed.success) return; // let the server action run
    e.preventDefault();
    setErrors(errorsByField<keyof Application>(parsed.error.issues));
    setFocusTick((n) => n + 1);
  }

  // Clear a field's error as soon as it changes.
  function onChange(e: React.FormEvent<HTMLFormElement>) {
    const name = (e.target as HTMLInputElement).name as keyof Application;
    if (!errors[name]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  const invalid = (field: keyof Application) => ({
    "aria-invalid": !!errors[field],
    "aria-describedby": errorId(field),
  });

  return (
    <form
      key={formKey}
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      onChange={onChange}
      className="space-y-6"
      noValidate
    >
      <fieldset>
        <legend id="tier-legend" className="mb-2 font-medium">
          Membership type
        </legend>
        <div
          role="radiogroup"
          aria-labelledby="tier-legend"
          {...invalid("tierId")}
          className="grid gap-2"
        >
          {tiers.map((tier) => (
            <label
              key={tier.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-300 bg-white p-3 has-checked:border-green-800 has-checked:bg-green-50"
            >
              <input
                type="radio"
                name="tierId"
                value={tier.id}
                defaultChecked={v?.tierId === tier.id}
                required
                className="mt-1 size-5 shrink-0 accent-green-800"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {tier.name}
                  {tier.isSample && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-600">
                      Sample
                    </span>
                  )}
                </span>
                {tier.notes && (
                  <span className="block text-sm text-stone-600">
                    {tier.notes}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        <FieldError field="tierId" message={errors.tierId} />
      </fieldset>

      <TextField
        label="Full name"
        name="name"
        autoComplete="name"
        defaultValue={v?.name}
        error={errors.name}
      />
      <label className="block">
        <span className="mb-1.5 block font-medium">Mailing address</span>
        <textarea
          name="address"
          rows={3}
          autoComplete="street-address"
          defaultValue={v?.address}
          required
          {...invalid("address")}
          className="input"
        />
        <FieldError field="address" message={errors.address} />
      </label>
      <TextField
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={v?.phone}
        error={errors.phone}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={v?.email}
        error={errors.email}
      />

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="cartShed"
          defaultChecked={v?.cartShed}
          className="mt-1 size-5 shrink-0 accent-green-800"
        />
        <span>
          <span className="font-medium">I&apos;d like to rent a Cart Shed</span>
          <span className="block text-sm text-stone-600">
            Store your own cart at the course.
          </span>
        </span>
      </label>

      {/* Honeypot: hidden from people, filled in by bots. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.error && !state.field && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-800">
          {state.error}
        </p>
      )}
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-800">
          Please fix the {Object.keys(errors).length === 1 ? "field" : "fields"}{" "}
          marked above.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
      >
        {pending ? "Sending…" : "Send application"}
      </button>
    </form>
  );
}

function TextField({
  label,
  error,
  ...input
}: {
  label: string;
  name: keyof Application;
  type?: string;
  autoComplete: string;
  defaultValue?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-medium">{label}</span>
      <input
        type="text"
        {...input}
        required
        aria-invalid={!!error}
        aria-describedby={errorId(input.name)}
        className="input"
      />
      <FieldError field={input.name} message={error} />
    </label>
  );
}
