import { ChatProvider } from "@/context/ChatContext";
import { Header } from "@/components/layout/Header";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      <div className="h-[100dvh] flex flex-col overflow-hidden">
        <Header />
        {children}
      </div>
    </ChatProvider>
  );
}
