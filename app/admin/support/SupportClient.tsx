"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDateTime } from "@/lib/utils";

type TicketStatus = "open" | "pending" | "closed" | string;
type StatusFilter = "all" | "open" | "pending" | "closed";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  created_at: string;
}

interface Reply {
  id: string;
  sender_role: string;
  message: string;
  created_at: string;
  sender_id: string;
}

const statusConfig = {
  open: {
    icon: AlertCircle,
    label: "Open",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
  closed: {
    icon: CheckCircle2,
    label: "Closed",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
} as const;

const filters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "closed", label: "Closed" },
];

const getStatusConfig = (status: TicketStatus) => {
  if (status === "open" || status === "pending" || status === "closed") {
    return statusConfig[status];
  }

  return {
    icon: AlertCircle,
    label: status || "Unknown",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
};

const StatusBadge = ({ status }: { status: TicketStatus }) => {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
};

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/40 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
      <Inbox className="h-7 w-7" />
    </div>
    <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
    <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
  </div>
);

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const fetchTickets = async () => {
    try {
      setLoadingTickets(true);
      const res = await fetch("/api/admin/support/tickets");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const nextTickets = data.tickets || [];
      setTickets(nextTickets);

      setSelected((current) => {
        if (!current) return current;
        return nextTickets.find((ticket: Ticket) => ticket.id === current.id) ?? current;
      });
    } catch {
      toast.error("Unable to load tickets");
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchTickets();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const openThread = async (ticket: Ticket) => {
    setSelected(ticket);
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/replies`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setReplies(data.replies || []);
    } catch {
      toast.error("Failed to load thread");
    } finally {
      setLoadingThread(false);
    }
  };

  const sendReply = async () => {
    if (!selected) return;
    const message = replyText.trim();
    if (!message) {
      toast.error("Message required");
      return;
    }
    if (sendingReply) return;

    try {
      setSendingReply(true);
      const res = await fetch(`/api/support/tickets/${selected.id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (!data.reply) throw new Error("Missing reply");
      setReplies((current) => [...current, data.reply]);
      setReplyText("");
      toast.success("Reply sent");
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const updateStatus = async (status: TicketStatus) => {
    if (!selected || updatingStatus) return;
    try {
      setUpdatingStatus(true);
      const res = await fetch(`/api/support/tickets/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      await res.json();
      toast.success("Status updated");
      setTickets((current) => current.map((ticket) => (ticket.id === selected.id ? { ...ticket, status } : ticket)));
      setSelected((current) => (current ? { ...current, status } : current));
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((ticket) => ticket.status === "open").length,
    pending: tickets.filter((ticket) => ticket.status === "pending").length,
    closed: tickets.filter((ticket) => ticket.status === "closed").length,
  }), [tickets]);

  const filteredTickets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      return `${ticket.subject} ${ticket.message} ${ticket.status}`.toLowerCase().includes(query);
    });
  }, [searchTerm, statusFilter, tickets]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
            <MessageCircle className="h-3.5 w-3.5" />
            Admin support desk
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Support Tickets</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review customer conversations, respond quickly, and keep ticket states tidy.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void fetchTickets()}
          disabled={loadingTickets}
          className="h-11 rounded-xl border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/60"
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loadingTickets && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total" value={stats.total} icon={Inbox} />
        <Metric label="Open" value={stats.open} icon={AlertCircle} accent="blue" />
        <Metric label="Pending" value={stats.pending} icon={Clock} accent="amber" />
        <Metric label="Closed" value={stats.closed} icon={CheckCircle2} accent="green" />
      </div>

      <div className="grid min-h-[640px] gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70">
          <div className="border-b border-slate-200/70 p-4 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search tickets..."
                className="h-11 rounded-xl border-slate-200 bg-white pl-10 dark:border-slate-700 dark:bg-slate-800/70"
              />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    "h-9 rounded-lg text-xs font-semibold text-slate-500 transition-colors dark:text-slate-400",
                    statusFilter === filter.value && "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loadingTickets ? (
              <div className="flex h-80 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <EmptyState title="No tickets found" description="Try a different search term or status filter." />
            ) : (
              <div className="space-y-2">
                {filteredTickets.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    active={selected?.id === ticket.id}
                    onClick={() => void openThread(ticket)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState title="Select a ticket" description="Choose a conversation from the inbox to view the thread and respond." />
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200/70 p-5 dark:border-slate-800">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={selected.status} />
                      <span className="text-xs font-medium text-slate-400">{formatDateTime(selected.created_at)}</span>
                    </div>
                    <h2 className="truncate text-xl font-bold text-slate-900 dark:text-white">{selected.subject}</h2>
                    <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {selected.message}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <StatusButton status="open" current={selected.status} disabled={updatingStatus} onClick={updateStatus} />
                    <StatusButton status="pending" current={selected.status} disabled={updatingStatus} onClick={updateStatus} />
                    <StatusButton status="closed" current={selected.status} disabled={updatingStatus} onClick={updateStatus} />
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-5 dark:bg-slate-950/30">
                {loadingThread ? (
                  <div className="flex h-full min-h-80 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : replies.length === 0 ? (
                  <EmptyState title="No replies yet" description="Start the conversation with a clear response for this ticket." />
                ) : (
                  <div className="space-y-4">
                    {replies.map((reply) => (
                      <ReplyBubble key={reply.id} reply={reply} />
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200/70 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/90">
                <div className="flex flex-col gap-3">
                  <Textarea
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder="Write a reply..."
                    className="min-h-24 resize-none rounded-xl border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-400">{replyText.trim().length} characters</p>
                    <Button onClick={() => void sendReply()} disabled={sendingReply || !replyText.trim()} className="h-11 rounded-xl bg-slate-900 px-5 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
                      {sendingReply ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send Reply
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const Metric = ({
  label,
  value,
  icon: Icon,
  accent = "slate",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "slate" | "blue" | "amber" | "green";
}) => {
  const accents = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
    green: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/70">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", accents[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

const TicketRow = ({ ticket, active, onClick }: { ticket: Ticket; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full rounded-xl border p-4 text-left transition-all",
      active
        ? "border-slate-900 bg-slate-900 text-white shadow-md dark:border-white dark:bg-white dark:text-slate-900"
        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700"
    )}
  >
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-bold", active ? "text-white dark:text-slate-900" : "text-slate-900 dark:text-white")}>
          {ticket.subject}
        </p>
        <p className={cn("mt-1 line-clamp-2 text-xs leading-5", active ? "text-white/70 dark:text-slate-600" : "text-slate-500 dark:text-slate-400")}>
          {ticket.message}
        </p>
      </div>
      <MessageCircle className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-white/60 dark:text-slate-500" : "text-slate-300")} />
    </div>
    <div className="flex items-center justify-between gap-3">
      <StatusBadge status={ticket.status} />
      <span className={cn("truncate text-[11px]", active ? "text-white/60 dark:text-slate-500" : "text-slate-400")}>
        {formatDateTime(ticket.created_at)}
      </span>
    </div>
  </button>
);

const ReplyBubble = ({ reply }: { reply: Reply }) => {
  const isAdmin = reply.sender_role === "admin";

  return (
    <div className={cn("flex gap-3", isAdmin && "justify-end")}>
      {!isAdmin && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-800">
          <UserRound className="h-4 w-4" />
        </div>
      )}
      <div className={cn("max-w-[78%] rounded-2xl border px-4 py-3 shadow-sm", isAdmin ? "border-slate-900 bg-slate-900 text-white dark:border-slate-700 dark:bg-slate-800" : "border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100")}>
        <div className="mb-1 flex items-center gap-2">
          <span className={cn("text-xs font-bold uppercase tracking-wider", isAdmin ? "text-white/70" : "text-slate-400")}>
            {isAdmin ? "Admin" : reply.sender_role || "User"}
          </span>
          <span className={cn("text-[11px]", isAdmin ? "text-white/50" : "text-slate-400")}>
            {formatDateTime(reply.created_at)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6">{reply.message}</p>
      </div>
    </div>
  );
};

const StatusButton = ({
  status,
  current,
  disabled,
  onClick,
}: {
  status: "open" | "pending" | "closed";
  current: TicketStatus;
  disabled: boolean;
  onClick: (status: TicketStatus) => void;
}) => {
  const Icon = status === "closed" ? CheckCircle2 : status === "pending" ? Clock : XCircle;
  const label = status === "closed" ? "Close" : status[0].toUpperCase() + status.slice(1);
  const active = current === status;

  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      disabled={disabled || active}
      onClick={() => onClick(status)}
      className={cn("h-9 rounded-xl", active && "bg-slate-900 text-white dark:bg-white dark:text-slate-900")}
    >
      <Icon className="mr-1.5 h-3.5 w-3.5" />
      {label}
    </Button>
  );
};
