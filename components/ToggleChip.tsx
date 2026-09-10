// Small toggle-pill primitive, shared by the feed's filter bar
// (app/page.tsx) and the profile form (app/profile/page.tsx) so both use
// the same control for "pick one" (rooms) and "pick many" (quartiers).
export default function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-foreground/70 hover:border-foreground"
      }`}
    >
      {children}
    </button>
  );
}
