/** Le logotype : le point « Vous êtes ici » posé contre le nom. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[17px] font-extrabold tracking-[-0.03em] ${className}`}>
      <span className="relative grid size-[18px] place-items-center rounded-full bg-signal" aria-hidden>
        <span className="size-[6px] rounded-full bg-on-signal" />
      </span>
      MapInter
    </span>
  );
}
