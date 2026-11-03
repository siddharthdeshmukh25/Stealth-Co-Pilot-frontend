"use client";
const labels: Record<string, string> = { listening: "Listening to speaker", transcribing: "Transcribing audio", thinking: "Preparing answer", streaming: "Streaming answer", exe_connected: "Desktop connected" };
const colors: Record<string, string> = { listening: "bg-emerald-400", transcribing: "bg-amber-400", thinking: "bg-blue-400", streaming: "bg-blue-400", exe_connected: "bg-emerald-400" };
export default function StatusIndicator({ state, connected }: { state: string; connected: boolean }) {
  const color = colors[state] || "bg-slate-500";
  return <span className="inline-flex items-center gap-2 text-xs text-slate-300"><i className={`h-2 w-2 rounded-full ${color} ${state === "listening" || state === "streaming" ? "animate-pulse" : ""}`} />{connected ? labels[state] || "Connecting" : "Reconnecting"}</span>;
}

