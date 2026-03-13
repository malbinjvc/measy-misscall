"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { LoadingPage } from "@/components/shared/loading";
import {
  LifeBuoy,
  Plus,
  ArrowLeft,
  Send,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Check,
  CheckCheck,
  Paperclip,
  FileText,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface TicketMessage {
  id: string;
  senderRole: string;
  senderName: string;
  message: string;
  attachmentUrls: string[];
  attachmentNames: string[];
  createdAt: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  lastReadByAdmin: string | null;
  lastReadByTenant: string | null;
  messages: TicketMessage[];
  _count?: { messages: number };
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse {
  data: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface PendingFile {
  url: string;
  name: string;
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; icon: typeof Clock; color: string }> = {
  OPEN: { label: "Open", icon: AlertCircle, color: "text-blue-600 bg-blue-50 border-blue-200" },
  IN_PROGRESS: { label: "In Progress", icon: Clock, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  RESOLVED: { label: "Resolved", icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
  CLOSED: { label: "Closed", icon: XCircle, color: "text-gray-600 bg-gray-50 border-gray-200" },
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW: "text-gray-600 bg-gray-100",
  MEDIUM: "text-blue-600 bg-blue-100",
  HIGH: "text-orange-600 bg-orange-100",
  URGENT: "text-red-600 bg-red-100",
};

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

function Attachments({ urls, names, isOwn }: { urls: string[]; names: string[]; isOwn: boolean }) {
  if (!urls.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {urls.map((url, i) => {
        const name = names[i] || url.split("/").pop() || "file";
        if (isImageUrl(url)) {
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt={name} className="max-w-[200px] max-h-[150px] rounded-md border object-cover" />
            </a>
          );
        }
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-black/5 transition-colors ${
              isOwn ? "border-white/30 text-primary-foreground" : "border-border"
            }`}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate max-w-[150px]">{name}</span>
            <Download className="h-3 w-3 shrink-0" />
          </a>
        );
      })}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-lg px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Admin is typing</span>
          <span className="flex gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        </div>
      </div>
    </div>
  );
}

function ReadReceipt({ msg, lastReadByAdmin }: { msg: TicketMessage; lastReadByAdmin: string | null }) {
  if (msg.senderRole !== "TENANT") return null;
  const isRead = lastReadByAdmin && new Date(lastReadByAdmin) >= new Date(msg.createdAt);
  return (
    <span className="inline-flex ml-1">
      {isRead ? (
        <CheckCheck className="h-3.5 w-3.5 text-blue-400" />
      ) : (
        <Check className="h-3.5 w-3.5 opacity-60" />
      )}
    </span>
  );
}

function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (fileList: FileList) => {
    setUploading(true);
    const newFiles: PendingFile[] = [];
    for (const file of Array.from(fileList)) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const json = await res.json();
        if (json.success) {
          newFiles.push({ url: json.data.url, name: file.name });
        }
      } catch {
        // skip failed uploads
      }
    }
    setFiles((prev) => [...prev, ...newFiles]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));
  const clear = () => setFiles([]);

  return { files, uploading, upload, remove, clear, inputRef };
}

function PendingFiles({ files, onRemove, uploading }: { files: PendingFile[]; onRemove: (i: number) => void; uploading: boolean }) {
  if (!files.length && !uploading) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {uploading && (
        <div className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
        </div>
      )}
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1 text-xs">
          {isImageUrl(f.url) ? (
            <img src={f.url} alt={f.name} className="h-6 w-6 rounded object-cover" />
          ) : (
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="truncate max-w-[120px]">{f.name}</span>
          <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

type View = "list" | "create" | "detail";

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("list");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Create form state
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const createUpload = useFileUpload();

  // Reply state
  const [reply, setReply] = useState("");
  const replyUpload = useFileUpload();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [adminTyping, setAdminTyping] = useState(false);

  const { data: ticketsResponse, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ["support-tickets", filterStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      params.set("page", String(page));
      params.set("pageSize", "50");
      const qs = params.toString();
      const res = await fetch(`/api/support/tickets?${qs}`);
      const json = await res.json();
      return {
        data: json.data ?? [],
        total: json.total ?? 0,
        page: json.page ?? 1,
        pageSize: json.pageSize ?? 50,
        totalPages: json.totalPages ?? 1,
      };
    },
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const tickets = ticketsResponse?.data;
  const totalPages = ticketsResponse?.totalPages ?? 1;
  const total = ticketsResponse?.total ?? 0;

  const { data: ticketDetail, isLoading: detailLoading } = useQuery<Ticket>({
    queryKey: ["support-ticket", selectedTicketId],
    queryFn: async () => {
      const res = await fetch(`/api/support/tickets/${selectedTicketId}`);
      const json = await res.json();
      return json.data;
    },
    enabled: !!selectedTicketId && view === "detail",
    refetchInterval: 15000,
  });

  useQuery({
    queryKey: ["typing-status", selectedTicketId],
    queryFn: async () => {
      const res = await fetch(`/api/support/tickets/${selectedTicketId}/typing`);
      const json = await res.json();
      setAdminTyping(!!json.typing);
      return json;
    },
    enabled: !!selectedTicketId && view === "detail",
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          message,
          priority,
          attachmentUrls: createUpload.files.map((f) => f.url),
          attachmentNames: createUpload.files.map((f) => f.name),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to create ticket");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setSubject("");
      setMessage("");
      setPriority("MEDIUM");
      createUpload.clear();
      setView("list");
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/support/tickets/${selectedTicketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: reply,
          attachmentUrls: replyUpload.files.map((f) => f.url),
          attachmentNames: replyUpload.files.map((f) => f.name),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to send message");
      return json.data;
    },
    onSuccess: () => {
      setReply("");
      replyUpload.clear();
      queryClient.invalidateQueries({ queryKey: ["support-ticket", selectedTicketId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  const sendTyping = useCallback(() => {
    if (!selectedTicketId) return;
    fetch(`/api/support/tickets/${selectedTicketId}/typing`, { method: "POST" }).catch(() => {});
  }, [selectedTicketId]);

  const handleReplyChange = useCallback((value: string) => {
    setReply(value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (value.trim()) {
      sendTyping();
      typingTimeoutRef.current = setTimeout(() => {}, 3000);
    }
  }, [sendTyping]);

  useEffect(() => {
    const msgCount = ticketDetail?.messages?.length || 0;
    if (msgCount > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMsgCountRef.current = msgCount;
  }, [ticketDetail?.messages?.length]);

  if (isLoading) return <LoadingPage />;

  // Create ticket view
  if (view === "create") {
    return (
      <div>
        <button onClick={() => setView("list")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </button>
        <h1 className="text-2xl font-bold tracking-tight mb-6">New Support Ticket</h1>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of your issue" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue in detail..." rows={6} />
            </div>
            {/* Attachments */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <input
                ref={createUpload.inputRef}
                type="file"
                multiple
                accept="image/*,video/mp4,video/webm,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.length && createUpload.upload(e.target.files)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => createUpload.inputRef.current?.click()} disabled={createUpload.uploading}>
                {createUpload.uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Paperclip className="mr-2 h-3.5 w-3.5" />}
                Attach Files
              </Button>
              <PendingFiles files={createUpload.files} onRemove={createUpload.remove} uploading={createUpload.uploading} />
            </div>
            {createMutation.isError && (
              <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
            )}
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!subject.trim() || !message.trim() || createMutation.isPending || createUpload.uploading}
            >
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Submit Ticket
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ticket detail view
  if (view === "detail" && selectedTicketId) {
    if (detailLoading || !ticketDetail) return <LoadingPage />;
    const statusCfg = STATUS_CONFIG[ticketDetail.status];
    const StatusIcon = statusCfg.icon;
    const isClosed = ticketDetail.status === "CLOSED";
    const canSend = (reply.trim() || replyUpload.files.length > 0) && !replyMutation.isPending && !replyUpload.uploading;

    return (
      <div>
        <button onClick={() => { setView("list"); setSelectedTicketId(null); setAdminTyping(false); replyUpload.clear(); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </button>

        <div className="flex flex-wrap items-start justify-between gap-2 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{ticketDetail.subject}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Created {new Date(ticketDetail.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}>
              <StatusIcon className="h-3 w-3" /> {statusCfg.label}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticketDetail.priority]}`}>
              {ticketDetail.priority}
            </span>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {ticketDetail.messages.map((msg) => {
                const isOwn = msg.senderRole === "TENANT";
                return (
                  <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-4 py-3 ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <p className="text-xs font-medium mb-1 opacity-75">{msg.senderName}</p>
                      {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                      <Attachments urls={msg.attachmentUrls || []} names={msg.attachmentNames || []} isOwn={isOwn} />
                      <div className="flex items-center justify-end gap-0.5 mt-1">
                        <span className="text-xs opacity-60">
                          {new Date(msg.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                        <ReadReceipt msg={msg} lastReadByAdmin={ticketDetail.lastReadByAdmin} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {adminTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            {!isClosed && (
              <div className="mt-4 pt-4 border-t">
                <PendingFiles files={replyUpload.files} onRemove={replyUpload.remove} uploading={replyUpload.uploading} />
                <div className="flex gap-2 mt-2">
                  <input
                    ref={replyUpload.inputRef}
                    type="file"
                    multiple
                    accept="image/*,video/mp4,video/webm,application/pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.length && replyUpload.upload(e.target.files)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => replyUpload.inputRef.current?.click()}
                    disabled={replyUpload.uploading}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    value={reply}
                    onChange={(e) => handleReplyChange(e.target.value)}
                    placeholder="Type your reply..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && canSend) {
                        e.preventDefault();
                        replyMutation.mutate();
                      }
                    }}
                  />
                  <Button onClick={() => replyMutation.mutate()} disabled={!canSend} size="icon">
                    {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
            {isClosed && (
              <p className="text-sm text-muted-foreground text-center mt-4 pt-4 border-t">
                This ticket is closed. Create a new ticket if you need further assistance.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ticket list view
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Support</h1>
        <Button onClick={() => setView("create")}>
          <Plus className="mr-2 h-4 w-4" /> New Ticket
        </Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["all", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilterStatus(s); setPage(1); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s === "all" ? "All" : STATUS_CONFIG[s as TicketStatus]?.label || s}
          </button>
        ))}
      </div>

      {!tickets?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <LifeBuoy className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No tickets yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Need help? Create a support ticket and we&apos;ll get back to you.</p>
            <Button onClick={() => setView("create")}><Plus className="mr-2 h-4 w-4" /> Create Ticket</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const statusCfg = STATUS_CONFIG[ticket.status];
            const StatusIcon = statusCfg.icon;
            const lastMsg = ticket.messages?.[0];
            return (
              <Card key={ticket.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setSelectedTicketId(ticket.id); setView("detail"); }}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{ticket.subject}</CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.color}`}><StatusIcon className="h-3 w-3" /> {statusCfg.label}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {lastMsg && <p className="text-sm text-muted-foreground line-clamp-1"><span className="font-medium">{lastMsg.senderName}:</span> {lastMsg.message}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{new Date(ticket.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <span>{ticket._count?.messages || 0} message{(ticket._count?.messages || 0) !== 1 ? "s" : ""}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({total} total)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
