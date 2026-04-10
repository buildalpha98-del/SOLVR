/**
 * ConsoleInvoices — Admin overview of all invoice chases across all clients.
 * Shows aggregate stats (total outstanding, active, escalated, collected) and
 * a searchable, filterable table of every chase in the system.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
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
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Loader2,
  MessageSquare,
} from "lucide-react";

type ChaseStatus = "active" | "paid" | "snoozed" | "cancelled" | "escalated";

const STATUS_COLOURS: Record<ChaseStatus, string> = {
  active: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  snoozed: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-400",
  escalated: "bg-red-100 text-red-700",
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

function daysSince(val: Date | string | null | undefined): number | null {
  if (!val) return null;
  return Math.floor((Date.now() - new Date(String(val)).getTime()) / (1000 * 60 * 60 * 24));
}

export default function ConsoleInvoices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: stats, isLoading: statsLoading } = trpc.adminInvoiceChasing.stats.useQuery();
  const { data: chases, isLoading: chasesLoading } = trpc.adminInvoiceChasing.listAll.useQuery(
    { status: statusFilter as ChaseStatus | "all" },
  );

  const filtered = (chases ?? []).filter((row) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      row.chase.invoiceNumber.toLowerCase().includes(q) ||
      row.chase.customerName.toLowerCase().includes(q) ||
      row.chase.customerEmail.toLowerCase().includes(q) ||
      (row.clientBusinessName ?? "").toLowerCase().includes(q) ||
      (row.tradingName ?? "").toLowerCase().includes(q)
    );
  });

  const isLoading = statsLoading || chasesLoading;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoice Chasing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All active invoice chases across every client. SMS fires on day 7 and day 14.
          </p>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        {statsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading stats…
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<DollarSign className="h-5 w-5 text-blue-600" />}
              label="Total Outstanding"
              value={fmtAUD(stats?.totalOutstanding)}
              bg="bg-blue-50"
            />
            <StatCard
              icon={<Clock className="h-5 w-5 text-amber-600" />}
              label="Active Chases"
              value={String(stats?.activeCount ?? 0)}
              bg="bg-amber-50"
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
              label="Escalated"
              value={String(stats?.escalatedCount ?? 0)}
              bg="bg-red-50"
            />
            <StatCard
              icon={<CheckCircle className="h-5 w-5 text-green-600" />}
              label="Total Collected"
              value={fmtAUD(stats?.totalCollected)}
              bg="bg-green-50"
            />
          </div>
        )}

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoice, customer, client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="snoozed">Snoozed</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading chases…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No invoice chases found</p>
            <p className="text-sm mt-1">
              {search || statusFilter !== "all"
                ? "Try adjusting your filters."
                : "Chases will appear here once clients start using the Invoice Chasing product."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Client</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Chases Sent</TableHead>
                  <TableHead>SMS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Chase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const { chase } = row;
                  const overdue = daysSince(chase.dueDate);
                  const hasSms = !!chase.customerPhone;
                  const status = chase.status as ChaseStatus;
                  return (
                    <TableRow key={chase.id} className={status === "escalated" ? "bg-red-50/40" : ""}>
                      <TableCell className="font-medium">
                        {row.tradingName ?? row.clientBusinessName ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{chase.invoiceNumber}</TableCell>
                      <TableCell>
                        <div className="text-sm">{chase.customerName}</div>
                        <div className="text-xs text-muted-foreground">{chase.customerEmail}</div>
                      </TableCell>
                      <TableCell className="font-medium">{fmtAUD(chase.amountDue)}</TableCell>
                      <TableCell>{fmtDate(chase.dueDate)}</TableCell>
                      <TableCell>
                        {overdue !== null ? (
                          <span className={overdue >= 14 ? "text-red-600 font-medium" : overdue >= 7 ? "text-amber-600" : ""}>
                            {overdue}d
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center">{chase.chaseCount}</TableCell>
                      <TableCell className="text-center">
                        {hasSms ? (
                          <MessageSquare className="h-4 w-4 text-blue-500 mx-auto" aria-label={chase.customerPhone ?? ""} />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${STATUS_COLOURS[status] ?? ""}`} variant="outline">
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {chase.nextChaseAt ? fmtDate(chase.nextChaseAt) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {chases?.length ?? 0} chase records
        </p>
      </div>
    </DashboardLayout>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
}) {
  return (
    <div className={`rounded-lg p-4 ${bg} flex items-start gap-3`}>
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// Re-export Receipt for use in the empty state
function Receipt({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="6 2 3 6 3 20 21 20 21 6 18 2" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="12" y1="6" x2="12" y2="2" />
    </svg>
  );
}
