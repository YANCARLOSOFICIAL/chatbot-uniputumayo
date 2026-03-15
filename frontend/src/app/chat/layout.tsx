import { ChatProvider } from "@/context/ChatContext";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <div className="h-[100dvh] overflow-hidden">
        {children}
      </div>
    </ChatProvider>
  );
}
