import { useEffect, useRef } from "react";

interface AutoLockOptions {
  minutes: number;
  onLock: () => void;
  enabled: boolean;
}

export function useAutoLock({ minutes, onLock, enabled }: AutoLockOptions) {
  const onLockRef = useRef(onLock);

  useEffect(() => {
    onLockRef.current = onLock;
  }, [onLock]);

  useEffect(() => {
    if (!enabled) return;
    let timer: number;
    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onLockRef.current(), minutes * 60_000);
    };
    resetTimer();
    window.addEventListener("pointerdown", resetTimer);
    window.addEventListener("keydown", resetTimer);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", resetTimer);
      window.removeEventListener("keydown", resetTimer);
    };
  }, [minutes, enabled]);
}
