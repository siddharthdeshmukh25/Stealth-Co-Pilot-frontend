"use client";

type Props = {
  state: string;
  connected: boolean;
  /** "on" | "paused" | "off" — reported by the desktop app. */
  captionState?: "on" | "paused" | "off";
};

const labels: Record<string, string> = {
  listening: "Listening to speaker",
  transcribing: "Transcribing audio",
  thinking: "Preparing answer",
  streaming: "Streaming answer",
  exe_connected: "Desktop connected",
  closed: "Interview ended",
};

export default function StatusIndicator({ state, connected, captionState = "off" }: Props) {
  const caption = captionState === "on" ? "" : captionState === "paused" ? "Captions paused" : "Live caption off";
  const tone = !connected
    ? { dot: "bg-amber-400", text: "Reconnecting" }
    : state === "closed"
      ? { dot: "bg-rose-400", text: labels.closed }
      : captionState === "on"
        ? { dot: "bg-emerald-400", text: labels[state] || "Listening" }
        : { dot: captionState === "paused" ? "bg-amber-400" : "bg-rose-400", text: caption };
  const pulse = connected && captionState === "on" && (state === "listening" || state === "streaming" || state === "transcribing");
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-medium leading-tight text-muted-foreground">
      <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot} ${pulse ? "animate-pulse" : ""}`} aria-hidden="true" />
      {tone.text}
    </span>
  );
}
