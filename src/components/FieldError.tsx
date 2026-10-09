import { errorId } from "@/lib/forms";

/**
 * A field's error message. Always rendered (empty when valid) so the field's
 * aria-describedby always points at something.
 */
export function FieldError({
  field,
  message,
}: {
  field: string;
  message?: string;
}) {
  return (
    <span
      id={errorId(field)}
      className={message ? "mt-1 block text-sm font-medium text-red-700" : ""}
    >
      {message}
    </span>
  );
}
