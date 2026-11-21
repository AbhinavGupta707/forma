"use client";
import { fmtClock } from "./format";

interface Props {
  left: number;
  total: number;
  onAdjust: (seconds: number) => void;
  onSkip: () => void;
}

export function RestBar({ left, total, onAdjust, onSkip }: Props) {
  const btn = "h-11 rounded-lg bg-panel px-3 text-sm font-medium";
  return (
    <div role="timer" aria-label="Rest timer" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="h-1 bg-panel"><div className="h-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${(left / Math.max(total, 1)) * 100}%` }} /></div>
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-2">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Rest</div>
          <div className="display tabular text-[2.25rem]">{fmtClock(left)}</div>
        </div>
        <button className={btn} onClick={() => onAdjust(-15)}>−15</button>
        <button className={btn} onClick={() => onAdjust(15)}>+15</button>
        <button className={`${btn} !bg-accent text-on-accent`} onClick={onSkip}>Skip</button>
      </div>
    </div>
  );
}
