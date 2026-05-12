'use client';

import { useEffect } from 'react';

interface Props {
  moveIndex: number;
  totalMoves: number;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
}

export function ReplayControls({ moveIndex, totalMoves, onFirst, onPrev, onNext, onLast }: Props) {
  const atStart = moveIndex === 0;
  const atEnd = moveIndex === totalMoves;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); onPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); onNext(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onPrev, onNext]);

  return (
    <div className="flex items-center justify-center gap-[8px] mt-[16px]">
      <ControlButton onClick={onFirst} disabled={atStart} label="Go to start">
        ««
      </ControlButton>
      <ControlButton onClick={onPrev} disabled={atStart} label="Previous move">
        ‹
      </ControlButton>
      <span className="font-mono text-[12px] text-muted w-[64px] text-center tabular-nums">
        {moveIndex} / {totalMoves}
      </span>
      <ControlButton onClick={onNext} disabled={atEnd} label="Next move">
        ›
      </ControlButton>
      <ControlButton onClick={onLast} disabled={atEnd} label="Go to end">
        »»
      </ControlButton>
    </div>
  );
}

function ControlButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="font-mono text-[16px] w-[36px] h-[36px] flex items-center justify-center border border-line rounded transition-colors duration-[100ms] disabled:opacity-30 disabled:pointer-events-none hover:bg-bg-soft"
    >
      {children}
    </button>
  );
}
