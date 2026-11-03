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
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35";

export default function QuickActionButtons({ onAskAI, onAction, onClear, disabled, hint }: Props) {
  return (
    <div className="shrink-0 border-t border-border/80 bg-background/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur sm:px-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            disabled={disabled}
            onClick={onAskAI}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Sparkles size={15} aria-hidden="true" />
            Ask AI about these captions
          </button>
          <button
            onClick={onClear}
            aria-label="Clear captions and answer"
            title="Clear captions and answer"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button disabled={disabled} onClick={() => onAction("explain_deeper")} className={secondary}>
            <Layers size={14} aria-hidden="true" />
            Explain deeper
          </button>
          <button disabled={disabled} onClick={() => onAction("code_example")} className={secondary}>
            <Code2 size={14} aria-hidden="true" />
            Code example
          </button>
        </div>
        {hint ? (
          <p className="text-center text-[11px] leading-4 text-muted-foreground" role="status">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
