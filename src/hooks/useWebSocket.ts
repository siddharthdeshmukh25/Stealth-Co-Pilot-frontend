"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type SocketEvent = { event: string; [key: string]: unknown };
const backendBase = () => process.env.NEXT_PUBLIC_BACKEND_URL || `http://${window.location.hostname}:8000`;

export function useWebSocket(sessionId: string) {
  const socket = useRef<WebSocket | null>(null);
  const eventQueue = useRef<SocketEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [eventsVersion, setEventsVersion] = useState(0);
  const takeEvents = useCallback(() => eventQueue.current.splice(0), []);
  const send = useCallback((message: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    let stopped = false;
    let roomClosed = false;
    let retry: ReturnType<typeof setTimeout>;
    let delay = 700;
    const connect = () => {
      if (stopped) return;
      const base = backendBase().replace(/^http/, "ws");
      const ws = new WebSocket(`${base}/ws/${sessionId}`);
      socket.current = ws;
      ws.onopen = () => { delay = 700; setConnected(true); };
      ws.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as SocketEvent;
          if (event.event === "room_closed") roomClosed = true;
          eventQueue.current.push(event);
          setEventsVersion((version) => version + 1);
        } catch { /* Ignore malformed frames. */ }
      };
      ws.onclose = () => { setConnected(false); if (!stopped && !roomClosed) { retry = setTimeout(connect, delay); delay = Math.min(delay * 1.8, 8000); } };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { stopped = true; clearTimeout(retry); socket.current?.close(); socket.current = null; };
  }, [sessionId]);
  return { connected, eventsVersion, takeEvents, send };
}

