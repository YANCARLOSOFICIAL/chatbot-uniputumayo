"use client";

import { useMemo, useSyncExternalStore } from "react";
import { isAuthenticated, type AuthUser } from "@/lib/auth";

/** Suscripción vacía: los valores solo cambian al hidratar, no en runtime. */
const emptySubscribe = () => () => {};

/** `true` únicamente después de la hidratación en el cliente. */
export function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/** Estado de sesión leído de localStorage sin setState dentro de un efecto. */
export function useAuthenticated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => isAuthenticated(), () => false);
}

/** Usuario persistido; la referencia se memoiza por valor serializado. */
export function useAuthUser(): AuthUser | null {
  const raw = useSyncExternalStore(
    emptySubscribe,
    () => localStorage.getItem("auth_user"),
    () => null
  );

  return useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }, [raw]);
}
