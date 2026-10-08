/** Scrolls to and focuses a form input by name, e.g. after a failed save. */
export function focusField(form: HTMLFormElement, name: string) {
  const el = form.elements.namedItem(name);
  const input =
    el instanceof RadioNodeList ? (el[0] as HTMLElement | undefined) : el;
  if (!(input instanceof HTMLElement)) return;
  input.scrollIntoView({ block: "center", behavior: "smooth" });
  input.focus({ preventScroll: true });
}
