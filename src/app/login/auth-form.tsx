"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "./actions";

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signingIn] = useActionState(signIn, undefined);
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, undefined);

  const isSignIn = mode === "signin";
  const state = isSignIn ? signInState : signUpState;
  const pending = isSignIn ? signingIn : signingUp;

  return (
    <div className="sheet rise flex flex-col gap-6 p-6 [animation-delay:60ms]">
      <div className="segmented" role="tablist">
        {(["signin", "signup"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
            {m === "signin" ? "Connexion" : "Inscription"}
          </button>
        ))}
      </div>

      <form action={isSignIn ? signInAction : signUpAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="field-label">
            E-mail
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label htmlFor="password" className="field-label">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={isSignIn ? undefined : 8}
            autoComplete={isSignIn ? "current-password" : "new-password"}
            className="input"
          />
          {!isSignIn && <p className="fine mt-1.5">8 caractères minimum.</p>}
        </div>

        {state?.error && (
          <p role="alert" className="text-[13.5px] font-semibold text-busy">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p role="status" className="well p-3 text-[13.5px] text-t2">
            {state.message}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary mt-1 w-full">
          {pending ? "Patientez…" : isSignIn ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>
    </div>
  );
}
