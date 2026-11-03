"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type SocketEvent = { event: string; [key: string]: unknown };
const backendBase = () => process.env.NEXT_PUBLIC_BACKEND_URL || `http://${window.location.hostname}:8000`;

export function useWebSocket(sessionId: string) {
  const socket = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SocketEvent | null>(null);
  const send = useCallback((message: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout>;
    let delay = 700;
    const connect = () => {
      if (stopped) return;
      const base = backendBase().replace(/^http/, "ws");
      const ws = new WebSocket(`${base}/ws/${sessionId}`);
      socket.current = ws;
      ws.onopen = () => { delay = 700; setConnected(true); };
      ws.onmessage = (message) => { try { setLastEvent(JSON.parse(message.data)); } catch { /* Ignore malformed frames. */ } };
      ws.onclose = () => { setConnected(false); if (!stopped) { retry = setTimeout(connect, delay); delay = Math.min(delay * 1.8, 8000); } };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { stopped = true; clearTimeout(retry); socket.current?.close(); socket.current = null; };
  }, [sessionId]);
  return { connected, lastEvent, send };
}

