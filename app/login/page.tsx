export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0">
      <div className="w-80 border border-border bg-bg-2">
        <div className="border-b border-border px-4 py-3">
          <span className="font-mono text-[13px] font-semibold text-text-primary">
            HELICON <span className="text-accent-resin">⟋</span> ARGOS
          </span>
          <span className="ml-2 font-mono text-[11px] text-text-muted">v0.0</span>
        </div>
        <form method="POST" action="/api/login" className="space-y-3 p-4">
          <label
            htmlFor="password"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted"
          >
            Access password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoFocus
            className="w-full border border-border bg-bg-inset px-2 py-1.5 font-mono text-[13px] text-text-primary outline-none focus:border-accent"
          />
          {error ? (
            <p className="font-mono text-[11px] text-status-critical">✕ wrong password</p>
          ) : null}
          <button
            type="submit"
            className="w-full cursor-pointer border border-border-strong bg-bg-3 px-2 py-1.5 text-[13px] text-text-primary transition-colors duration-100 hover:border-accent"
          >
            Enter console
          </button>
        </form>
      </div>
    </div>
  );
}
