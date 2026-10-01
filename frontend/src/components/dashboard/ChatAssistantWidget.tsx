import React, { useState, useRef, useEffect } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { useLanguage } from "@/context/LanguageContext";
import { sendChatMessage } from "@/lib/chat-service";
import type { ChatMessageHistoryItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Send, Bot, User, Loader2, Sparkles } from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

export function ChatAssistantWidget() {
  const { location, forecast, cropType, cropStage } = useDashboard();
  const { t, language } = useLanguage();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      sender: "assistant",
      text: t.assistant.welcomeMsg,
      timestamp: "Just now",
    },
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    t.assistant.suggested1,
    t.assistant.suggested2,
    t.assistant.suggested3,
  ]);
  const [activeModel, setActiveModel] = useState<string>("Gemini AI");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Synchronize welcome message and starter suggested prompts whenever language changes
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length <= 1) {
        return [
          {
            id: "welcome",
            sender: "assistant",
            text: t.assistant.welcomeMsg,
            timestamp: "Just now",
          },
        ];
      }
      return prev;
    });

    setSuggestedPrompts([
      t.assistant.suggested1,
      t.assistant.suggested2,
      t.assistant.suggested3,
    ]);
  }, [language, t.assistant.welcomeMsg, t.assistant.suggested1, t.assistant.suggested2, t.assistant.suggested3]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    const history: ChatMessageHistoryItem[] = messages.slice(-6).map((m) => ({
      sender: m.sender,
      text: m.text,
    }));

    try {
      const chatRes = await sendChatMessage(query, {
        location,
        forecast,
        cropType,
        cropStage,
        language,
        history,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: chatRes.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Dynamically update prompt options in the selected language
      if (chatRes.suggested_options && chatRes.suggested_options.length > 0) {
        setSuggestedPrompts(chatRes.suggested_options);
      }
      if (chatRes.model_used && chatRes.model_used.includes("gemini")) {
        setActiveModel("Gemini AI");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "assistant",
          text: t.common.error,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {!isOpen ? (
          <Button
            type="button"
            onClick={() => setIsOpen(true)}
            size="lg"
            className="group relative h-14 w-14 rounded-full bg-signal p-0 text-signal-foreground shadow-lg shadow-signal/30 hover:scale-105 hover:bg-signal/90 transition-all duration-300 cursor-pointer"
            aria-label={t.assistant.title}
          >
            <Bot className="size-7 transition-transform group-hover:rotate-6" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-cyan border-2 border-background" />
            </span>
          </Button>
        ) : null}
      </div>

      {/* Floating Chat Modal / Drawer */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[580px] w-[90vw] max-w-sm flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-2xl transition-all sm:w-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg border border-signal/30 bg-signal/15">
                <Bot className="size-4 text-signal" />
              </span>
              <div>
                <div className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
                  <span>{t.assistant.title}</span>
                  <Badge
                    variant="outline"
                    className="border-signal/30 bg-signal/10 px-1.5 py-0 text-[9px] font-mono text-signal uppercase"
                  >
                    {language.toUpperCase()} · {activeModel}
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {location.taluk || "Karnataka"} · {cropType}
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="size-8 rounded-full p-0 text-muted-foreground hover:bg-background/80 hover:text-foreground cursor-pointer"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => {
              const isUser = m.sender === "user";
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] ${
                      isUser ? "bg-signal text-signal-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                  </div>
                  <div
                    className={`max-w-[78%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      isUser
                        ? "bg-signal text-signal-foreground rounded-tr-none shadow-sm"
                        : "border border-border/60 bg-background/80 text-foreground rounded-tl-none shadow-sm"
                    }`}
                  >
                    <div className="whitespace-pre-line">{m.text}</div>
                    <div
                      className={`mt-1 text-[9px] font-mono ${
                        isUser ? "text-signal-foreground/75 text-right" : "text-muted-foreground"
                      }`}
                    >
                      {m.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2">
                <div className="grid size-6 place-items-center rounded-full bg-muted text-muted-foreground text-[10px]">
                  <Bot className="size-3.5" />
                </div>
                <div className="rounded-xl border border-border/60 bg-background/80 px-3.5 py-2 rounded-tl-none">
                  <div className="flex items-center gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-signal" />
                    <span className="size-1.5 animate-bounce rounded-full bg-signal [animation-delay:0.2s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-signal [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts / Options */}
          <div className="border-t border-border/40 bg-background/40 px-3 py-2">
            <div className="flex items-center gap-1 mb-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3 text-signal" /> {t.assistant.suggestedQueries}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-signal hover:text-foreground truncate max-w-full text-left cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 border-t border-border/60 bg-background/90 p-3"
          >
            <Input
              type="text"
              placeholder={t.assistant.placeholder}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isTyping}
              className="h-9 border-border/70 bg-background text-xs text-foreground focus-visible:ring-signal"
            />
            <Button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              size="sm"
              className="h-9 w-9 bg-signal p-0 text-signal-foreground hover:bg-signal/90 cursor-pointer"
            >
              {isTyping ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
