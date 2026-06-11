"use client";

import { useEffect, useState } from "react";

export function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="text-xs text-slate-400">{time}</span>;
}
