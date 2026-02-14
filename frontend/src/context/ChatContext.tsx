"use client";

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from "react";
import type { Conversation, Message, SourceInfo } from "@/types/chat";
import type { AvatarState } from "@/types/avatar";

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  sources: SourceInfo[];
  isLoading: boolean;
  avatarState: AvatarState;
  inputMode: "text" | "voice";
  error: string | null;
}

type ChatAction =
  | { type: "SET_CONVERSATIONS"; payload: Conversation[] }
  | { type: "SET_ACTIVE_CONVERSATION"; payload: string | null }
  | { type: "SET_MESSAGES"; payload: Message[] }
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "SET_SOURCES"; payload: SourceInfo[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_AVATAR_STATE"; payload: AvatarState }
  | { type: "SET_INPUT_MODE"; payload: "text" | "voice" }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "ADD_CONVERSATION"; payload: Conversation }
  | { type: "REMOVE_CONVERSATION"; payload: string };

const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  messages: [],
  sources: [],
  isLoading: false,
  avatarState: "idle",
  inputMode: "text",
  error: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_CONVERSATIONS":
      return { ...state, conversations: action.payload };
    case "SET_ACTIVE_CONVERSATION":
      return { ...state, activeConversationId: action.payload, messages: [], sources: [] };
    case "SET_MESSAGES":
      return { ...state, messages: action.payload };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "SET_SOURCES":
      return { ...state, sources: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_AVATAR_STATE":
      return { ...state, avatarState: action.payload };
    case "SET_INPUT_MODE":
      return { ...state, inputMode: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "ADD_CONVERSATION":
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
      };
    case "REMOVE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.filter(
          (c) => c.id !== action.payload
        ),
        activeConversationId:
          state.activeConversationId === action.payload
            ? null
            : state.activeConversationId,
      };
    default:
      return state;
  }
}

const ChatContext = createContext<{
  state: ChatState;
  dispatch: Dispatch<ChatAction>;
} | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  return (
    <ChatContext.Provider value={{ state, dispatch }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
