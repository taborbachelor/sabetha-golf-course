"use client";

import { startTransition, useActionState, useState } from "react";
import type { TierRow } from "@/lib/memberships/tiers";
import { deleteTier, saveTier, type TierSaveState } from "./actions";

/**
 * Add (no tier) or edit one membership type. Submitted by hand so a failed
 * save keeps the typed values instead of React resetting the form.
 */
export function TierForm({
  tier,
  nextSortOrder,
}: {
  tier?: TierRow;
  nextSortOrder?: number;
}) {
  const [state, save, saving] = useActionState<TierSaveState, FormData>(
    saveTier,
    {},
  );
  const [delState, remove, deleting] = useActionState<TierSaveState, FormData>(
    deleteTier,
    {},
  );
  const [confirming, setConfirming] = useState(false);
  const message = delState.message && !delState.ok ? delState : state;

  return (
    <form
      // A new type starts the add form over; edits stay as saved.
      key={tier ? tier.id : (state.savedAt ?? 0)}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => save(data));
      }}
      noValidate
      className="grid gap-3 sm:grid-cols-6"
    >
      {tier && <input type="hidden" name="id" value={tier.id} />}
      <label className="block sm:col-span-3">
        <span className="mb-1 block text-sm font-medium">Name</span>
        <input name="name" defaultValue={tier?.name} className="input py-2" />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-sm font-medium">Yearly dues</span>
        <span className="flex items-center gap-1">
          <span className="text-stone-600">$</span>
          <input
            name="price"
            inputMode="decimal"
            defaultValue={tier ? String(tier.price_cents / 100) : ""}
            className="input py-2"
          />
        </span>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Order</span>
        <input
          name="sortOrder"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={tier?.sort_order ?? nextSortOrder ?? 0}
          className="input py-2"
        />
      </label>
      <label className="block sm:col-span-5">
        <span className="mb-1 block text-sm font-medium">
          Description (optional)
        </span>
        <input
          name="notes"
          defaultValue={tier?.notes ?? ""}
          className="input py-2"
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-2.5">
        <input
          type="checkbox"
          name="isSample"
          defaultChecked={tier?.is_sample}
          className="size-5 accent-green-800"
        />
        Sample
      </label>

      <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-green-800 px-4 py-2.5 font-semibold text-white hover:bg-green-900 disabled:bg-stone-400"
        >
          {saving ? "Saving…" : tier ? "Save" : "Add type"}
        </button>
        {tier &&
          (confirming ? (
            <>
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  const data = new FormData();
                  data.set("id", tier.id);
                  startTransition(() => remove(data));
                }}
                className="rounded-lg bg-red-700 px-4 py-2.5 font-semibold text-white hover:bg-red-800 disabled:bg-stone-400"
              >
                {deleting ? "Deleting…" : `Delete ${tier.name}`}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="chip min-h-10 text-sm"
              >
                Keep it
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="chip min-h-10 text-sm"
            >
              Delete…
            </button>
          ))}
        {message.message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={`text-sm ${message.ok ? "text-green-800" : "text-red-700"}`}
          >
            {message.message}
          </p>
        )}
      </div>
    </form>
  );
}
