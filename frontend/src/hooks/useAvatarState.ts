"use client";

import { useEffect } from "react";
import { useChatContext } from "@/context/ChatContext";
import type { AvatarState } from "@/types/avatar";

export function useAvatarState() {
  const { state, dispatch } = useChatContext();

  const setAvatarState = (newState: AvatarState) => {
    dispatch({ type: "SET_AVATAR_STATE", payload: newState });
  };

  // Auto-return to idle after speaking
  useEffect(() => {
    if (state.avatarState === "speaking") {
      const timer = setTimeout(() => {
        setAvatarState("idle");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.avatarState]);

  return {
    avatarState: state.avatarState,
    setAvatarState,
  };
}
