export function ChessTrackerSkeleton() {
  return (
    <div className="mt-[40px] mb-[48px]" aria-busy="true" aria-label="Loading tournament data">
      <div className="h-[14px] w-[160px] rounded-sm bg-bg-soft animate-pulse mb-[10px]" />
      <div className="h-[28px] w-[280px] rounded-sm bg-bg-soft animate-pulse" />
    </div>
  );
}
