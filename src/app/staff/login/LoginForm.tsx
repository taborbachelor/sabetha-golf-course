"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1.5 block font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email}
          required
          className="input"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-green-800 px-5 py-4 text-lg font-bold text-white hover:bg-green-900 disabled:bg-stone-400"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
