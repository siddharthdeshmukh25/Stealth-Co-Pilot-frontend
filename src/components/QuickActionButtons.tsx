"use client";
import { Code2, Layers, Sparkles, Trash2 } from "lucide-react";

type Props = {
  onAskAI: () => void;
  onAction: (action: "explain_deeper" | "code_example") => void;
  onClear: () => void;
  disabled: boolean;
  hint?: string;
};

const secondary =
  "press inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 text-[12px] font-semibold text-foreground/85 backdrop-blur transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35";

export default function QuickActionButtons({ onAskAI, onAction, onClear, disabled, hint }: Props) {
  return (
    <div className="glass safe-bottom z-30 shrink-0 rounded-t-3xl px-3 pt-2.5">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
        {hint ? (
          <p className="text-center text-[10.5px] leading-4 text-muted-foreground" role="status">
            {hint}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            disabled={disabled}
            onClick={onAskAI}
            className="press group relative inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[0_18px_36px_-20px_var(--glow)] transition-[filter,transform] hover:brightness-[1.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-35"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:[animation:sheen_0.9s_ease-out]"
            />
            <Sparkles size={16} aria-hidden="true" />
            Ask AI
          </button>
          <button
            onClick={onClear}
            aria-label="Clear answer output"
            title="Clear answer output"
            className="press inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-card/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <button disabled={disabled} onClick={() => onAction("explain_deeper")} className={secondary}>
            <Layers size={14} aria-hidden="true" />
            Explain deeper
          </button>
          <button disabled={disabled} onClick={() => onAction("code_example")} className={secondary}>
            <Code2 size={14} aria-hidden="true" />
            Code example
          </button>
        </div>
      </div>
    </div>
  );
}
