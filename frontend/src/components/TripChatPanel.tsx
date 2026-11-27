import React, { useEffect, useRef, useState } from 'react';
import { Lock, MessageSquare, Send } from 'lucide-react';
import { apiRequest } from '../services/api';
import { getTrackingSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Spinner, btn, cardCls } from './ui';

export interface TripChatMessage {
  id: string;
  trip_id: string;
  sender_id: string;
  sender_role: 'DRIVER' | 'RIDER';
  sender_name: string;
  sender_university_role?: 'STUDENT' | 'FACULTY';
  message: string;
  created_at: string;
}

interface TripChatPanelProps {
  tripId: string;
  isDriver: boolean;
}

const DRIVER_QUICK_REPLIES = [
  'On my way now!',
  '5 mins away from your pick-up stop',
  'Arrived at the pick-up point — hazard lights on',
];

const RIDER_QUICK_REPLIES = [
  "I'm already at the pick-up point",
  'Heading down now, 2 mins!',
  'Copy, thank you!',
];

export const TripChatPanel: React.FC<TripChatPanelProps> = ({ tripId, isDriver }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TripChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setAccessDenied(false);
    setError(null);

    apiRequest<{ messages: TripChatMessage[] }>(`/chat/${tripId}`)
      .then((res) => {
        if (active) setMessages(res.messages);
      })
      .catch((err: Error) => {
        if (!active) return;
        if (err.message.toLowerCase().includes('book a seat') || err.message.includes('403')) {
          setAccessDenied(true);
        } else {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const socket = getTrackingSocket();
    const handleIncoming = (msg: TripChatMessage) => {
      if (msg.trip_id !== tripId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };

    socket.on('chat:message', handleIncoming);
    return () => {
      active = false;
      socket.off('chat:message', handleIncoming);
    };
  }, [tripId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);

    try {
      const res = await apiRequest<{ message: TripChatMessage }>(`/chat/${tripId}`, {
        method: 'POST',
        body: JSON.stringify({ message: trimmed }),
      });
      setMessages((prev) =>
        prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]
      );
      setText('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(text);
  };

  const quickReplies = isDriver ? DRIVER_QUICK_REPLIES : RIDER_QUICK_REPLIES;

  return (
    <section className={`${cardCls} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-cardinal-700" />
          <h3 className="text-sm font-semibold text-slate-900">Trip Chat (Driver &amp; Riders)</h3>
        </div>
        <span className="rounded-full bg-emerald-600/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
          Live
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-8 text-xs text-slate-500">
          <Spinner className="h-4 w-4" /> Loading trip messages...
        </div>
      ) : accessDenied ? (
        <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-xs text-slate-500">
          <Lock className="h-5 w-5 text-slate-400" />
          <p className="font-semibold text-slate-700">Trip chat is private to confirmed participants</p>
          <p>Book a seat on this carpool to message the driver and fellow riders.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Message Feed */}
          <div className="max-h-80 min-h-[180px] space-y-3 overflow-y-auto bg-white p-5">
            {messages.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No messages yet. Coordinate your exact pick-up spot or ETA here!
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">{isMe ? 'You' : m.sender_name}</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                          m.sender_role === 'DRIVER'
                            ? 'bg-cardinal-100 text-cardinal-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {m.sender_role === 'DRIVER' ? 'Driver' : 'Rider'}
                      </span>
                      <span>
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div
                      className={`max-w-[82%] rounded-[20px] px-4 py-2 text-[14px] leading-snug ${
                        isMe
                          ? 'rounded-br-md bg-cardinal-700 text-white'
                          : 'rounded-bl-md bg-slate-900/[0.06] text-slate-900'
                      }`}
                    >
                      {m.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick-reply chips */}
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-white px-4 pt-3">
            {quickReplies.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={sending}
                onClick={() => sendMessage(chip)}
                className="rounded-full bg-slate-900/[0.05] px-3 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-900/[0.09] hover:text-slate-900 active:scale-95"
              >
                {chip}
              </button>
            ))}
          </div>

          {error && (
            <div className="px-4 pt-2 text-xs text-red-600">{error}</div>
          )}

          {/* Input Bar */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-white p-4 pt-2.5">
            <input
              type="text"
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                isDriver
                  ? 'Message your riders (e.g. "Passing Welcome Rotonda now")...'
                  : 'Message your driver (e.g. "Wearing a red hoodie near the gate")...'
              }
              className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-base placeholder:text-slate-400 transition focus:border-cardinal-600 focus:outline-none focus:ring-4 focus:ring-cardinal-600/15 sm:text-[14px]"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className={btn('primary', 'sm')}
            >
              {sending ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </button>
          </form>
        </div>
      )}
    </section>
  );
};
