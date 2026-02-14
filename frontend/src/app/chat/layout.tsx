import { ChatProvider } from "@/context/ChatContext";
import { Header } from "@/components/layout/Header";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      <div className="h-screen flex flex-col">
        <Header />
        {children}
      </div>
    </ChatProvider>
  );
}
