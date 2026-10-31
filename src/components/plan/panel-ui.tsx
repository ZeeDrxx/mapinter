import type { ReactNode } from "react";

/** Section de panneau : une étiquette, un filet, le contenu. */
export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 border-b border-hair pb-1.5">
        <h2 className="label">{title}</h2>
        {aside && <span className="fine">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** Aide contextuelle : un aplat, jamais une boîte colorée. */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="well px-3.5 py-3 text-[13px] leading-relaxed text-t2">{children}</p>;
}

/** Bloc de l'élément sélectionné. */
export function Selection({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rise flex flex-col gap-3 rounded-sign bg-sheet p-4 shadow-sheet">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[13px] font-bold">
          <span className="size-2 rounded-full bg-signal" aria-hidden />
          {title}
        </p>
        {aside && <span className="num font-mono text-[11.5px] text-t3">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export function Range({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label flex justify-between">
        {label}
        <span className="num font-mono font-medium text-t3">{display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--ink)]"
      />
    </div>
  );
}

/** Message d'erreur : teinte d'avertissement, jamais le signal. */
export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[13px] font-semibold text-busy">
      {children}
    </p>
  );
}
