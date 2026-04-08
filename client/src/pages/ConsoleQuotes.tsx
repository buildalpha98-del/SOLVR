/**
 * ConsoleQuotes — Admin overview of all quotes across all clients.
 * Shows stats (total, sent, accepted, declined, conversion rate) and a
 * searchable, filterable table of every quote in the system.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText, TrendingUp, CheckCircle, XCircle, Clock,
  Search, ExternalLink, Loader2,
} from "lucide-react";

type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired" | "cancelled";

const STATUS_COLOURS: Record<QuoteStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-400",
};

function fmtAUD(val: string | null | undefined) {
  if (!val) return "—";
  return `$${parseFloat(val).toLocaleString("en-AU", { minimumFractionDigits: 0 })}`;
}

function fmtDate(val: Date | string | null | undefined) {
  if (!val) return "—";
  return new Date(String(val)).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ConsoleQuotes() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: quotes, isLoading } = trpc.quotes.list.useQuery();

  const filtered = (quotes ?? []).filter((q) => {
    const matchesSearch =
      !search ||
      q.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
      (q.customerName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      q.quoteNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total = quotes?.length ?? 0;
  const sent = quotes?.filter((q) => q.status === "sent").length ?? 0;
  const accepted = quotes?.filter((q) => q.status === "accepted").length ?? 0;
  const declined = quotes?.filter((q) => q.status === "declined").length ?? 0;
  const conversionRate =
    sent + accepted + declined > 0
      ? Math.round((accepted / (sent + accepted + declined)) * 100)
      : 0;
  const totalValue = (quotes ?? [])
    .filter((q) => q.status === "accepted")
    .reduce((s, q) => s + parseFloat(q.totalAmount ?? "0"), 0);

  const stats = [
    {
      label: "Total Quotes",
      value: total,
      icon: FileText,
      colour: "text-gray-600",
      bg: "bg-gray-50",
    },
    {
      label: "Sent / Pending",
      value: sent,
      icon: Clock,
      colour: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Accepted",
      value: accepted,
      icon: CheckCircle,
      colour: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Conversion Rate",
      value: `${conversionRate}%`,
      icon: TrendingUp,
      colour: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Accepted Value",
      value: `$${totalValue.toLocaleString("en-AU", { minimumFractionDigits: 0 })}`,
      icon: TrendingUp,
      colour: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Declined",
      value: declined,
      icon: XCircle,
      colour: "text-red-500",
      bg: "bg-red-50",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quotes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All quotes across all clients
            </p>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rounded-xl p-4 ${s.bg} border border-transparent`}
            >
              <s.icon className={`w-4 h-4 mb-2 ${s.colour}`} />
              <p className={`text-xl font-bold ${s.colour}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by quote #, job title, or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {search || statusFilter !== "all"
                  ? "No quotes match your filters"
                  : "No quotes yet"}
              </p>
              {!search && statusFilter === "all" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Quotes will appear here once clients start using the Voice-to-Quote engine.
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setLocation(`/console/quotes/${q.id}`)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {q.quoteNumber}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {q.jobTitle}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">
                      {q.customerName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs font-medium border-0 ${STATUS_COLOURS[q.status as QuoteStatus] ?? ""}`}
                      >
                        {q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmtAUD(q.totalAmount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(q.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(q.sentAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/console/quotes/${q.id}`);
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            Showing {filtered.length} of {total} quotes
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
