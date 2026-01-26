'use client';

import { useChat } from '@ai-sdk/react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function ChatWindow({ isOpen }: { isOpen: boolean }) {
  const { messages, append, isLoading } = useChat({
    api: '/api/chat', // We'll mock this endpoint
    initialMessages: [
         { id: 'welcome', role: 'assistant', content: "Hello! I'm the Land Oracle AI. How can I assist with your property research today?" }
    ]
  } as any) as any;

  const [input, setInput] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    await append({ role: 'user', content: input });
    setInput('');
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
        <div className="p-2 bg-blue-600/20 rounded-lg">
            <Bot className="w-5 h-5 text-blue-400" />
        </div>
        <div>
            <h3 className="text-white font-semibold text-sm">Land Oracle AI</h3>
            <p className="text-xs text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Online
            </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {messages.map((m: any) => (
            <div
                key={m.id}
                className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
                <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                    ${m.role === 'user' ? 'bg-blue-600' : 'bg-slate-800'}
                `}>
                    {m.role === 'user' ? <User size={14} className="text-white/90" /> : <Bot size={14} className="text-blue-400" />}
                </div>
                
                <div className={`
                    max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                    ${m.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-sm' 
                        : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'}
                `}>
                    {m.content}
                </div>
            </div>
        ))}
        {isLoading && (
            <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Bot size={14} className="text-blue-400" />
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="relative">
            <input 
                className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 focus:border-blue-500/50 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                value={input}
                onChange={handleInputChange}
                placeholder="Ask about a property..."
            />
            <button 
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
            >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
        </div>
        <div className="text-center mt-2">
            <span className="text-[10px] text-slate-500">
                AI can make mistakes. Verify important data.
            </span>
        </div>
      </form>
    </div>
  );
}
