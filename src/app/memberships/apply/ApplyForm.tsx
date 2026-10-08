"use client";

import { useActionState } from "react";
import { submitApplication, type ApplyState } from "./actions";

export type TierOption = {
  id: string;
  name: string;
  notes: string | null;
  isSample: boolean;
};

export function ApplyForm({ tiers }: { tiers: TierOption[] }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(
    submitApplication,
    {},
  );
  const v = state.values;
  // React resets the form after each submit; the key remounts the fields so
  // their defaultValues come back from the echoed values.
  const formKey = JSON.stringify(v ?? {});

  const fieldError = (field: ApplyState["field"]) =>
    state.field === field ? state.error : undefined;

  return (
    <form key={formKey} action={action} className="space-y-6" noValidate>
      <fieldset>
        <legend className="mb-2 font-medium">Membership type</legend>
        <div className="grid gap-2">
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
                className="mt-1 size-5 accent-green-800"
              />
              <span>
                <span className="flex items-center gap-2 font-semibold">
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
        <FieldError message={fieldError("tierId")} />
      </fieldset>

      <TextField
        label="Full name"
        name="name"
        autoComplete="name"
        defaultValue={v?.name}
        error={fieldError("name")}
      />
      <label className="block">
        <span className="mb-1.5 block font-medium">Mailing address</span>
        <textarea
          name="address"
          rows={3}
          autoComplete="street-address"
          defaultValue={v?.address}
          required
          aria-invalid={!!fieldError("address")}
          className="input"
        />
        <FieldError message={fieldError("address")} />
      </label>
      <TextField
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={v?.phone}
        error={fieldError("phone")}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={v?.email}
        error={fieldError("email")}
      />

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="cartShed"
          defaultChecked={v?.cartShed}
          className="mt-1 size-5 accent-green-800"
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
      {state.field && (
        <p role="alert" className="sr-only">
          {state.error}
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
  name: string;
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
        className="input"
      />
      <FieldError message={error} />
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1 block text-sm text-red-700">{message}</span>;
}
