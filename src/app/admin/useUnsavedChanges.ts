"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether a form has edits that haven't been saved, and asks the
 * browser to warn before the page is closed or reloaded while it does.
 * `result` is the form's useActionState state: a new successful result
 * means the edits were saved. Pass `onChange` to the <form>.
 */
export function useUnsavedChanges(result: { ok?: boolean }) {
  const [dirty, setDirty] = useState(false);
  const [lastResult, setLastResult] = useState(result);
  if (result !== lastResult) {
    // A save finished: clean if it worked, still unsaved if it didn't.
    setLastResult(result);
    if (result.ok) setDirty(false);
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older browsers need returnValue set to show the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return { dirty, onChange: () => setDirty(true) };
}
