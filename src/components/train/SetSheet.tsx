"use client";
import type { SetData, SetKind } from "@/lib/train/metrics";
import { Button, Sheet } from "@/components/ui";

const KINDS: { value: SetKind; label: string; hint: string }[] = [
  { value: "normal", label: "Normal", hint: "A working set" },
  { value: "warmup", label: "Warm-up", hint: "Left out of volume and records" },
  { value: "drop", label: "Drop set", hint: "Weight reduced straight after" },
  { value: "failure", label: "To failure", hint: "No reps left" },
];

const RPE = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

interface Props {
  set: SetData | null;
  onClose: () => void;
  onChange: (patch: Partial<SetData>) => void;
  onDelete: () => void;
}

export function SetSheet({ set, onClose, onChange, onDelete }: Props) {
  return (
    <Sheet open={set !== null} onClose={onClose} title="Set options">
      {set && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button key={k.value} onClick={() => onChange({ kind: k.value })}
                className={`rounded-lg p-3 text-left ${set.kind === k.value ? "bg-accent text-on-accent" : "bg-panel"}`}>
                <span className="block text-sm font-medium">{k.label}</span>
                <span className={`text-xs ${set.kind === k.value ? "" : "text-muted"}`}>{k.hint}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="eyebrow mb-2">Effort (RPE)</p>
            <div className="grid grid-cols-4 gap-1.5">
              {RPE.map((r) => (
                <button key={r} onClick={() => onChange({ rpe: set.rpe === r ? null : r })}
                  className={`tabular rounded-lg py-2 text-sm ${set.rpe === r ? "bg-accent text-on-accent" : "bg-panel"}`}>{r}</button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">10 means no reps left, 8 means two left. Logging this makes suggestions better.</p>
          </div>
          <Button variant="danger" className="w-full" onClick={onDelete}>Delete set</Button>
        </div>
      )}
    </Sheet>
  );
}
