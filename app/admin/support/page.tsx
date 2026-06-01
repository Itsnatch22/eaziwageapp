"use client";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}
interface Reply {
  id: string;
  sender_role: string;
  message: string;
  created_at: string;
  sender_id: string;
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");

  const fetchTickets = async () => {
    try {
      const res = await fetch("/api/admin/support/tickets");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (err) {
      toast.error("Unable to load tickets");
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const openThread = async (t: Ticket) => {
    setSelected(t);
    try {
      const res = await fetch(`/api/support/tickets/${t.id}/replies`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setReplies(data.replies || []);
    } catch {
      toast.error("Failed to load thread");
    }
  };

  const sendReply = async () => {
    if (!selected) return;
    if (!replyText.trim()) return toast.error("Message required");
    // Optimistic UI: append temporary reply immediately
    const tempId = `temp-${Date.now()}`;
    const optimistic: Reply = {
      id: tempId,
      sender_role: "admin",
      message: replyText,
      created_at: new Date().toISOString(),
      sender_id: "me",
    };
    setReplies((r) => [...r, optimistic]);
    const prevText = replyText;
    setReplyText("");

    try {
      const res = await fetch(`/api/support/tickets/${selected.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prevText }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      // Replace optimistic reply with real one
      setReplies((r) => r.map((rep) => (rep.id === tempId ? data.reply : rep)));
      toast.success("Reply sent");
    } catch {
      // Rollback optimistic reply
      setReplies((r) => r.filter((rep) => rep.id !== tempId));
      setReplyText(prevText);
      toast.error("Failed to send reply");
    }
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/support/tickets/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      toast.success("Status updated");
      fetchTickets();
      setSelected((s) => (s ? { ...s, status } : s));
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Support Tickets</h1>
      <div className="flex gap-6">
        <div className="w-1/3">
          <ul>
            {tickets.map((t) => (
              <li
                key={t.id}
                className="p-3 border rounded mb-2 cursor-pointer"
                onClick={() => openThread(t)}
              >
                <div className="font-semibold">{t.subject}</div>
                <div className="text-sm text-slate-500">
                  {t.status} • {new Date(t.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1">
          {!selected ? (
            <div>Select a ticket to view conversation</div>
          ) : (
            <div>
              <div className="mb-3">
                <h2 className="text-xl font-semibold">{selected.subject}</h2>
                <div className="text-sm text-slate-500">
                  Status: {selected.status}
                </div>
                <div className="mt-2">{selected.message}</div>
              </div>

              <div className="space-y-2 mb-4">
                {replies.map((r) => (
                  <div
                    key={r.id}
                    className={`p-3 rounded ${r.sender_role === "admin" ? "bg-slate-100" : "bg-white"} border`}
                  >
                    <div className="text-sm text-slate-600">
                      {r.sender_role}
                    </div>
                    <div className="mt-1">{r.message}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 p-2 border rounded"
                  placeholder="Write a reply..."
                />
                <button
                  onClick={sendReply}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Send
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => updateStatus("open")}
                  className="px-3 py-1 border rounded"
                >
                  Open
                </button>
                <button
                  onClick={() => updateStatus("pending")}
                  className="px-3 py-1 border rounded"
                >
                  Pending
                </button>
                <button
                  onClick={() => updateStatus("closed")}
                  className="px-3 py-1 border rounded"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
