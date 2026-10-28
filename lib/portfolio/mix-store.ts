"use client";

import { useSyncExternalStore } from "react";
import { FLAT_MIX, type Mix } from "./channels";

/**
 * The visitor's fader positions, shared by the desk (which sets them) and
 * the closing call (which lays the work out by them). Lives for the visit
 * only.
 */

let current: Mix = FLAT_MIX;
const listeners = new Set<() => void>();

export function setMix(next: Mix | ((m: Mix) => Mix)) {
  current = typeof next === "function" ? next(current) : next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMix(): Mix {
  return useSyncExternalStore(subscribe, () => current, () => FLAT_MIX);
}
