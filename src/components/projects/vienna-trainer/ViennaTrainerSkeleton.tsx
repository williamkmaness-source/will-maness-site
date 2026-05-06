// ViennaTrainerSkeleton — shown while the heavy ViennaTrainer bundle hydrates.
// Matches the board + controls layout so there is no layout shift on load.

export function ViennaTrainerSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{ maxWidth: 480, width: '100%' }}
    >
      {/* Board placeholder */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 4,
          backgroundColor: 'var(--bg-soft)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      {/* Controls row placeholder */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' }}>
        <div
          style={{
            height: 36,
            width: 72,
            borderRadius: 4,
            backgroundColor: 'var(--bg-soft)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
        <div
          style={{
            height: 20,
            width: 160,
            borderRadius: 4,
            backgroundColor: 'var(--bg-soft)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}
