"use client";

import { useCallback } from "react";

type TransitionCallback = () => void;

type ViewTransitionStarter = (cb: TransitionCallback) => {
  finish: Promise<void>;
};

export function useViewTransition() {
  const withViewTransition = useCallback((callback: TransitionCallback) => {
    if (typeof document === "undefined") {
      callback();
      return;
    }

    const startTransition = (
      document as unknown as {
        startViewTransition?: ViewTransitionStarter;
      }
    ).startViewTransition;

    if (typeof startTransition === "function") {
      startTransition(() => callback());
      return;
    }

    callback();
  }, []);

  return { withViewTransition };
}
