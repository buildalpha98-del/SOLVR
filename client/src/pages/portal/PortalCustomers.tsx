/**
 * Portal Customers — Tradie's completed-jobs client database.
 * Every paid job automatically adds the customer here.
 * Searchable, exportable to CSV for future email marketing.
 */
import { useState, useMemo } from "react";
import PortalLayout from "./PortalLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Users, Search, Download, Phone, Mail, MapPin,
  DollarSign, Briefcase, Clock, Edit2, Save, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function centsToAud(cents: number | null | undefined) {
  if (!cents) return "$0";
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 0 })}`;
}

interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  jobCount: number;
  totalSpentCents: number;
  firstJobAt: Date | null;
  lastJobAt: Date | null;
  lastJobType: string | null;
  notes: string | null;
  tags: string | null;
}

function EditableCell({
  value,
  onSave,
  placeholder = "—",
  type = "text",
}: {
  value: string | null | undefined;
  onSave: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  return editing ? (
    <div className="flex items-center gap-1">
      <input
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        className="w-full text-xs px-1.5 py-0.5 rounded outline-none"
        style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
        autoFocus
        onKeyDown={e => {
          if (e.key === "Enter") { onSave(draft); setEditing(false); }
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
      />
      <button onClick={() => { onSave(draft); setEditing(false); }} className="text-green-400"><Save className="w-3 h-3" /></button>
      <button onClick={() => { setDraft(value ?? ""); setEditing(false); }} className="text-red-400"><X className="w-3 h-3" /></button>
    </div>
  ) : (
    <div className="flex items-center gap-1 group cursor-pointer" onClick={() => { setDraft(value ?? ""); setEditing(true); }}>
      <span className="text-xs" style={{ color: value ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)" }}>
        {value || placeholder}
      </span>
      <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "rgba(255,255,255,0.3)" }} />
    </div>
  );
}

export default function PortalCustomers() {
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const { data: customers = [], isLoading } = trpc.portal.listTradieCustomers.useQuery(undefined, {
    staleTime: 60 * 1000,
  });

  const updateCustomer = trpc.portal.updateTradieCustomer.useMutation({
    onSuccess: () => { utils.portal.listTradieCustomers.invalidate(); toast.success("Saved"); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return customers as Customer[];
    const q = search.toLowerCase();
    return (customers as Customer[]).filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.address ?? "").toLowerCase().includes(q) ||
      (c.lastJobType ?? "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  function exportCsv() {
    const rows = [
      ["Name", "Phone", "Email", "Address", "Jobs", "Total Spent", "Last Job Type", "Last Job Date", "Notes"],
      ...(customers as Customer[]).map(c => [
        c.name,
        c.phone ?? "",
        c.email ?? "",
        c.address ?? "",
        String(c.jobCount),
        String((c.totalSpentCents / 100).toFixed(2)),
        c.lastJobType ?? "",
        formatDate(c.lastJobAt),
        c.notes ?? "",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solvr-customers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  const totalRevenue = (customers as Customer[]).reduce((s, c) => s + c.totalSpentCents, 0);
  const totalJobs = (customers as Customer[]).reduce((s, c) => s + c.jobCount, 0);

  return (
    <PortalLayout>
      <div className="space-y-5 pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: "#F5A623" }} />
              Customer Database
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Every completed and paid job automatically adds the customer here.
            </p>
          </div>
          <Button
            size="sm"
            onClick={exportCsv}
            disabled={(customers as Customer[]).length === 0}
            style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Customers", value: String((customers as Customer[]).length), icon: <Users className="w-4 h-4" /> },
            { label: "Total Jobs", value: String(totalJobs), icon: <Briefcase className="w-4 h-4" /> },
            { label: "Total Revenue", value: centsToAud(totalRevenue), icon: <DollarSign className="w-4 h-4" /> },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl p-4" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                {stat.icon}
                <span className="text-xs">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, email, job type..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "#0F1F3D", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#F5A623" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
            <p className="text-sm font-medium text-white mb-1">
              {search ? "No customers match your search" : "No customers yet"}
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              {search ? "Try a different search term." : "Customers are added automatically when you mark a job as paid."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: "#0F1F3D", border: "1px solid rgba(255,255,255,0.07)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Customer", "Contact", "Jobs", "Total Spent", "Last Job", "Notes"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wide font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                  >
                    {/* Customer name + address */}
                    <td className="px-4 py-3">
                      <EditableCell
                        value={c.name}
                        onSave={v => updateCustomer.mutate({ id: c.id, name: v })}
                      />
                      {c.address && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />
                          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{c.address}</span>
                        </div>
                      )}
                    </td>
                    {/* Contact */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />
                          <EditableCell
                            value={c.phone}
                            onSave={v => updateCustomer.mutate({ id: c.id, phone: v })}
                            placeholder="Add phone"
                            type="tel"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail className="w-2.5 h-2.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />
                          <EditableCell
                            value={c.email}
                            onSave={v => updateCustomer.mutate({ id: c.id, email: v })}
                            placeholder="Add email"
                            type="email"
                          />
                        </div>
                      </div>
                    </td>
                    {/* Jobs */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-white">{c.jobCount}</p>
                      {c.lastJobType && (
                        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{c.lastJobType}</p>
                      )}
                    </td>
                    {/* Total spent */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>{centsToAud(c.totalSpentCents)}</p>
                    </td>
                    {/* Last job */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" style={{ color: "rgba(255,255,255,0.2)" }} />
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{formatDate(c.lastJobAt)}</span>
                      </div>
                    </td>
                    {/* Notes */}
                    <td className="px-4 py-3 max-w-[160px]">
                      <EditableCell
                        value={c.notes}
                        onSave={v => updateCustomer.mutate({ id: c.id, notes: v })}
                        placeholder="Add note..."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
