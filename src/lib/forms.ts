/** Helpers for showing form errors the same way on every public form. */

type Issue = { path: PropertyKey[]; message: string };

/**
 * Zod issues -> one message per field (the first issue wins), so a form can
 * show every problem at once instead of one at a time.
 */
export function errorsByField<K extends string>(
  issues: readonly Issue[],
): Partial<Record<K, string>> {
  const errors: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string") errors[field as K] ??= issue.message;
  }
  return errors;
}

/** Element id for a field's error message, for aria-describedby. */
export const errorId = (field: string) => `${field}-error`;

/**
 * Scroll the first invalid field (aria-invalid="true") into the middle of the
 * screen, clear of the sticky header, and focus it. Call after the errors
 * have rendered.
 */
export function focusFirstInvalid(root: HTMLElement | null): void {
  const el = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!el) return;
  // A radio group is marked as a whole; focus its chosen (or first) option.
  const target =
    el.getAttribute("role") === "radiogroup"
      ? (el.querySelector<HTMLElement>("input:checked") ??
        el.querySelector<HTMLElement>("input"))
      : el;
  el.scrollIntoView({ block: "center" });
  target?.focus({ preventScroll: true });
}
