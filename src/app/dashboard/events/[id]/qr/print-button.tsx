"use client";

export function PrintButton({ disabled }: { disabled?: boolean }) {
  return (
    <button type="button" onClick={() => window.print()} disabled={disabled} className="btn-primary">
      Imprimer / PDF
    </button>
  );
}
