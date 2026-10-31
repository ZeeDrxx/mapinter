"use client";

export function PrintButton({ disabled }: { disabled?: boolean }) {
  return (
    <button type="button" onClick={() => window.print()} disabled={disabled} className="btn btn-primary">
      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
        <path d="M5.5 7V3h9v4M5.5 14h-2V8a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v6h-2M5.5 11.5h9V17h-9Z" />
      </svg>
      Imprimer / PDF
    </button>
  );
}
