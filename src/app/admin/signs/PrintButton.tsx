"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-green-800 px-4 py-2.5 font-semibold text-white hover:bg-green-900"
    >
      Print this sheet
    </button>
  );
}
