"use client";

import { startTransition, useActionState, useState } from "react";
import { defaultKind } from "@/lib/menu/form";
import type { MenuRow } from "@/lib/orders/order";
import { useUnsavedChanges } from "../useUnsavedChanges";
import { deleteMenuItem, saveMenuItem, type MenuSaveState } from "./actions";

/**
 * Add (no item) or edit one menu item. Submitted by hand so a failed save
 * keeps the typed values instead of React resetting the form.
 */
export function MenuItemForm({
  item,
  categories,
  nextSortOrder,
}: {
  item?: MenuRow;
  categories: string[];
  nextSortOrder?: number;
}) {
  const [state, save, saving] = useActionState<MenuSaveState, FormData>(
    saveMenuItem,
    {},
  );
  const [delState, remove, deleting] = useActionState<MenuSaveState, FormData>(
    deleteMenuItem,
    {},
  );
  const [confirming, setConfirming] = useState(false);
  const { onChange } = useUnsavedChanges(state);
  const listId = `categories-${item?.id ?? "new"}`;
  const message = delState.message && !delState.ok ? delState : state;

  return (
    <form
      // A new item starts the add form over; edits stay as saved.
      key={item ? item.id : (state.savedAt ?? 0)}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => save(data));
      }}
      onChange={(e) => {
        onChange();
        const field = e.target;
        const form = e.currentTarget;
        if (!(field instanceof HTMLInputElement)) return;
        if (field.name === "kind") form.dataset.kindChosen = "yes";
        // A new item under "Drinks" starts as a drink, unless the admin
        // already picked a type.
        if (!item && field.name === "category" && !form.dataset.kindChosen) {
          const kind = form.elements.namedItem("kind") as RadioNodeList;
          kind.value = defaultKind(field.value);
        }
      }}
      noValidate
      className="grid gap-3 sm:grid-cols-6"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <label className="block sm:col-span-3">
        <span className="mb-1 block text-sm font-medium">Name</span>
        <input name="name" defaultValue={item?.name} className="input py-2" />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-sm font-medium">Section</span>
        <input
          name="category"
          list={listId}
          defaultValue={item?.category}
          className="input py-2"
        />
        <datalist id={listId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Price</span>
        <span className="flex items-center gap-1">
          <span className="text-stone-600">$</span>
          <input
            name="price"
            inputMode="decimal"
            defaultValue={item ? (item.price_cents / 100).toFixed(2) : ""}
            className="input py-2"
          />
        </span>
      </label>

      <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-4">
        <legend className="sr-only">Type and options</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="kind"
            value="food"
            defaultChecked={item?.is_food ?? true}
            className="size-5 accent-green-800"
          />
          Food
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="kind"
            value="drink"
            defaultChecked={item ? !item.is_food : false}
            className="size-5 accent-green-800"
          />
          Drink
        </label>
        <Check name="isAlcohol" label="21+" checked={item?.is_alcohol} />
        <Check
          name="available"
          label="On the menu"
          checked={item?.available ?? true}
        />
        <Check name="isSample" label="Sample" checked={item?.is_sample} />
      </fieldset>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-sm font-medium">Order on menu</span>
        <input
          name="sortOrder"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={item?.sort_order ?? nextSortOrder ?? 0}
          aria-describedby={`${listId}-order-hint`}
          className="input py-2"
        />
        <span
          id={`${listId}-order-hint`}
          className="mt-1 block text-xs text-stone-500"
        >
          Lower numbers show first.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-green-800 px-4 py-2.5 font-semibold text-white hover:bg-green-900 disabled:bg-stone-400"
        >
          {saving ? "Saving…" : item ? "Save" : "Add item"}
        </button>
        {item &&
          (confirming ? (
            <>
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  const data = new FormData();
                  data.set("id", item.id);
                  startTransition(() => remove(data));
                }}
                className="rounded-lg bg-red-700 px-4 py-2.5 font-semibold text-white hover:bg-red-800 disabled:bg-stone-400"
              >
                {deleting ? "Deleting…" : `Delete ${item.name}`}
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

function Check({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="size-5 accent-green-800"
      />
      {label}
    </label>
  );
}
