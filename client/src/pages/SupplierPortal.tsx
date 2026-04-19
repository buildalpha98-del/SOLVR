/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd (ABN 47 262 120 626).
 * Unauthorised copying or distribution is strictly prohibited.
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, FileText, Loader2, AlertTriangle, Package } from "lucide-react";

export default function SupplierPortal() {
  const { token } = useParams<{ token: string }>();
  const [acknowledged, setAcknowledged] = useState(false);

  const { data: po, isLoading, error } = trpc.purchaseOrders.getBySupplierToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false }
  );

  const ackMutation = trpc.purchaseOrders.acknowledgeByToken.useMutation({
    onSuccess: (res) => {
      setAcknowledged(true);
      if (res.alreadyAcknowledged) {
        toast.info("This purchase order was already acknowledged.");
      } else {
        toast.success("Purchase order acknowledged successfully!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#F5A623]" />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-[#0F1F3D] mb-2">
            Purchase Order Not Found
          </h1>
          <p className="text-gray-600">
            This link may have expired or is invalid. Please contact the business that sent you this purchase order.
          </p>
        </div>
      </div>
    );
  }

  const isAcked = acknowledged || po.status === "acknowledged" || po.status === "received";
  const statusLabel: Record<string, string> = {
    draft: "Draft",
    sent: "Awaiting Acknowledgement",
    acknowledged: "Acknowledged",
    received: "Received",
    cancelled: "Cancelled",
  };
  const statusColor: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    sent: "bg-amber-100 text-amber-800",
    acknowledged: "bg-green-100 text-green-800",
    received: "bg-blue-100 text-blue-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <header className="bg-[#0F1F3D] text-white py-6">
        <div className="max-w-3xl mx-auto px-6 flex items-center gap-4">
          {po.business.logoUrl ? (
            <img src={po.business.logoUrl} alt="" className="w-10 h-10 rounded object-contain bg-white p-1" />
          ) : (
            <div className="w-10 h-10 rounded bg-[#F5A623] flex items-center justify-center">
              <Package className="w-5 h-5 text-[#0F1F3D]" />
            </div>
          )}
          <div>
            <h1 className="font-display text-xl font-bold">{po.business.name}</h1>
            <p className="text-white/60 text-sm">Purchase Order</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* PO Header Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#0F1F3D]">{po.poNumber}</h2>
              <p className="text-gray-500 text-sm">
                Issued {new Date(po.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor[isAcked ? "acknowledged" : po.status] ?? statusColor.draft}`}>
              {isAcked ? "Acknowledged" : (statusLabel[po.status] ?? po.status)}
            </span>
          </div>

          {po.supplier && (
            <div className="text-sm text-gray-600 mb-2">
              <strong>To:</strong> {po.supplier.contactName ?? po.supplier.name}
            </div>
          )}
          {po.requiredByDate && (
            <div className="text-sm text-gray-600 mb-2">
              <strong>Required by:</strong>{" "}
              {new Date(po.requiredByDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
          {po.deliveryAddress && (
            <div className="text-sm text-gray-600 mb-2">
              <strong>Deliver to:</strong> {po.deliveryAddress}
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0F1F3D] text-white">
                <th className="text-left px-4 py-3 font-medium">Item</th>
                <th className="text-center px-4 py-3 font-medium">Qty</th>
                <th className="text-right px-4 py-3 font-medium">Unit Price</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 text-center">{item.quantity} {item.unit}</td>
                  <td className="px-4 py-3 text-right">
                    {item.unitPriceCents ? `$${(item.unitPriceCents / 100).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {item.lineTotalCents ? `$${(item.lineTotalCents / 100).toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#0F1F3D]">
                <td colSpan={3} className="px-4 py-3 text-right font-bold text-[#0F1F3D]">
                  Total (ex GST)
                </td>
                <td className="px-4 py-3 text-right font-bold text-[#0F1F3D] text-lg">
                  ${(po.totalCents / 100).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        {po.notes && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-display text-sm font-bold text-[#0F1F3D] mb-2 uppercase tracking-wide">Notes</h3>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">{po.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!isAcked && po.status !== "cancelled" && (
            <Button
              onClick={() => ackMutation.mutate({ token: token ?? "" })}
              disabled={ackMutation.isPending}
              className="bg-[#F5A623] hover:bg-[#e09510] text-[#0F1F3D] font-bold px-8 py-3 text-base"
            >
              {ackMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Acknowledge Purchase Order
            </Button>
          )}
          {isAcked && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">Purchase order acknowledged</span>
            </div>
          )}
          {po.pdfUrl && (
            <Button
              variant="outline"
              asChild
              className="border-[#0F1F3D] text-[#0F1F3D]"
            >
              <a href={po.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </a>
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-8 pb-4">
          Powered by{" "}
          <a href="https://solvr.com.au" className="text-[#F5A623] hover:underline" target="_blank" rel="noopener noreferrer">
            Solvr
          </a>
          {" "}— Smart tools for Australian tradies
        </div>
      </main>
    </div>
  );
}
