"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseReadResources } from "@/lib/atlas/study";

const STORAGE_KEY = "akashic:study-read:v1";
const CHANGE_EVENT = "akashic:study-progress";
let sessionSnapshot = "[]";
let sessionOnly = false;

function snapshot(): string {
  if (sessionOnly) return sessionSnapshot;
  try { return window.localStorage.getItem(STORAGE_KEY) ?? "[]"; }
  catch { return sessionSnapshot; }
}
function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) notify(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(CHANGE_EVENT, notify); };
}
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Explicit progress is shared between paths and the library; opening a link is not completion. */
export function useStudyProgress() {
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const readIds = useMemo(() => parseReadResources(raw), [raw]);
  const toggleRead = (id: string) => {
    const next = parseReadResources(snapshot());
    if (next.has(id)) next.delete(id); else next.add(id);
    sessionSnapshot = JSON.stringify([...next]);
    try { window.localStorage.setItem(STORAGE_KEY, sessionSnapshot); } catch { sessionOnly = true; }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return { readIds, toggleRead, ready };
}
