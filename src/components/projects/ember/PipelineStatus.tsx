function formatCheckedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

interface PipelineStatusProps {
  lastCheckedAt: string | null;
}

export function PipelineStatus({ lastCheckedAt }: PipelineStatusProps) {
  return (
    <div className="flex items-center gap-[8px] mb-[28px]">
      {lastCheckedAt ? (
        <>
          <span className="inline-block w-[6px] h-[6px] rounded-full bg-accent shrink-0" />
          <span className="font-mono text-[11px] text-hint">
            Last checked {formatCheckedAt(lastCheckedAt)}
          </span>
        </>
      ) : (
        <>
          <span className="inline-block w-[6px] h-[6px] rounded-full bg-hint shrink-0" />
          <span className="font-mono text-[11px] text-hint">Pipeline initializing…</span>
        </>
      )}
    </div>
  );
}
