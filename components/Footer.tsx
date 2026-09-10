// Shared by app/page.tsx and app/profile/page.tsx. Real agency list/count
// only — no fake latency/uptime figure (see design/design-system.md's
// non-negotiable rule).
export default function Footer({
  agencies,
}: {
  agencies: { _id: string; name: string }[] | undefined;
}) {
  return (
    <footer className="border-t border-border mt-8">
      <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-foreground/40 flex flex-row flex-wrap gap-x-2 gap-y-1">
        {agencies && agencies.length > 0 && (
          <span>
            {agencies.length} régies : {agencies.map((a) => a.name).join(", ")}
          </span>
        )}
        <span className="ml-auto">© {new Date().getFullYear()} firstkey</span>
      </div>
    </footer>
  );
}
