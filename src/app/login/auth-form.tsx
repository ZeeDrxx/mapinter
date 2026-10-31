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
    <div className="card flex flex-col gap-5">
      <div className="grid grid-cols-2 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md py-1.5 font-medium ${
              mode === m ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500"
            }`}
          >
            {m === "signin" ? "Connexion" : "Inscription"}
          </button>
        ))}
      </div>

      <form action={isSignIn ? signInAction : signUpAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="label">
            E-mail
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">
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
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.message && <p className="text-sm text-green-700">{state.message}</p>}

        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Patientez…" : isSignIn ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>
    </div>
  );
}
