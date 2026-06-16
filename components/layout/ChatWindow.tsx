'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, X, MessageSquare, Loader2, User, 
  Trash2, Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface ChatWindowProps {
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  onClose: () => void;
}

export function ChatWindow({ currentUserId, otherUserId, otherUserName, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?with=${otherUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data || []);
      }
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setLoading(false);
    }
  }, [otherUserId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchMessages();
    }, 0);

    const supabase = createClient();
    type RealtimeMessagePayload = { new: Message; old?: Message };

    const channel = supabase
      .channel(`realtime:messages:user-${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentUserId}`
      }, (payload: RealtimeMessagePayload) => {
        const data = payload.new;
        if (data.sender_id === otherUserId || data.receiver_id === otherUserId) {
          setMessages(prev => [...prev, data]);
        }
      })
      .subscribe();

    return () => {
      window.clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [currentUserId, otherUserId, fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: otherUserId,
          content: newMessage.trim()
        })
      });

      if (res.ok) {
        setNewMessage('');
      } else {
        toast.error('Failed to send message');
      }
    } catch {
      toast.error('Error sending message');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    try {
        const res = await fetch(`/api/messages?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            setMessages(prev => prev.filter(m => m.id !== id));
            toast.success('Message deleted');
        }
    } catch {
        toast.error('Failed to delete message');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 sm:w-96 h-125 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="p-4 bg-linear-to-r from-primary to-emerald-600 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/10">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight">{otherUserName}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-[10px] text-white/70 font-medium">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Phone className="w-4 h-4" />
            </button>
            <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-1"
            >
                <X className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-xs font-medium uppercase tracking-wider">Loading history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-slate-400" />
            </div>
            <div>
                <p className="text-slate-900 dark:text-white font-bold text-sm">Start a conversation</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                    Say hello to {otherUserName}! Your messages are end-to-end encrypted.
                </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%] group relative",
                  isMe ? "ml-auto items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-2xl text-sm shadow-sm transition-all",
                    isMe
                      ? "bg-primary text-white rounded-tr-none hover:shadow-md"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-none hover:bg-slate-200 dark:hover:bg-slate-700"
                  )}
                >
                  {msg.content}
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                    <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && (
                        <button 
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl h-11"
            disabled={sending}
          />
          <button 
            type="submit" 
            disabled={sending || !newMessage.trim()}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-xl shrink-0 h-11 w-11 shadow-lg shadow-primary/20"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
