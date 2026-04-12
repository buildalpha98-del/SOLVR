/**
 * PaymentLink — Public payment page served at /pay/:token
 *
 * Customers arrive here from an SMS payment link.
 * Shows invoice summary and a Stripe Checkout button.
 * Mobile-first design — built for a customer on their phone.
 */
import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { getSolvrOrigin } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, CreditCard, Building2, Phone } from "lucide-react";

export default function PaymentLink() {
  const [, params] = useRoute("/pay/:token");
  const token = params?.token ?? "";
  const [paying, setPaying] = useState(false);

  const { data, isLoading, error } = trpc.portal.getPaymentLink.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const createCheckout = trpc.portal.createPaymentLinkCheckout.useMutation({
    onSuccess: (result) => {
      if (result.url) {
        window.location.href = result.url;
      }
    },
    onError: (err) => {
      setPaying(false);
      alert(`Payment failed: ${err.message}`);
    },
  });

  const handlePay = () => {
    setPaying(true);
    createCheckout.mutate({ token, origin: getSolvrOrigin() });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Not Found</h2>
          <p className="text-gray-500 text-sm">
            This payment link may have expired or already been paid. Please contact your service provider.
          </p>
        </div>
      </div>
    );
  }

  if (data.status === "paid") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Received</h2>
          <p className="text-gray-500 text-sm">
            Thank you! Your payment for invoice {data.invoiceNumber} has been received.
          </p>
        </div>
      </div>
    );
  }

  if (data.status === "expired") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h2>
          <p className="text-gray-500 text-sm">
            This payment link has expired. Please contact your service provider for a new link.
          </p>
          {data.businessPhone && (
            <a
              href={`tel:${data.businessPhone}`}
              className="mt-4 inline-flex items-center gap-2 text-blue-600 font-medium"
            >
              <Phone className="w-4 h-4" />
              {data.businessPhone}
            </a>
          )}
        </div>
      </div>
    );
  }

  const amountDollars = (data.amountCents / 100).toFixed(2);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-3">
          {data.businessLogo ? (
            <img src={data.businessLogo} alt={data.businessName} className="h-8 w-8 rounded object-contain" />
          ) : (
            <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">{data.businessName}</p>
            <p className="text-xs text-gray-500">Secure Payment</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Invoice Summary */}
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="text-center mb-5">
              <p className="text-sm text-gray-500 mb-1">Amount Due</p>
              <p className="text-4xl font-bold text-gray-900">${amountDollars}</p>
              <p className="text-xs text-gray-400 mt-1">inc. GST</p>
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Invoice</span>
                <span className="font-medium text-gray-900">{data.invoiceNumber}</span>
              </div>
              {data.jobTitle && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Job</span>
                  <span className="font-medium text-gray-900 text-right max-w-[60%]">{data.jobTitle}</span>
                </div>
              )}
              {data.customerName && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-medium text-gray-900">{data.customerName}</span>
                </div>
              )}
              {data.expiresAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Link expires</span>
                  <span className="font-medium text-gray-900">
                    {new Date(data.expiresAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pay Button */}
        <Button
          onClick={handlePay}
          disabled={paying}
          className="w-full h-14 text-base font-semibold bg-blue-600 hover:bg-blue-700"
        >
          {paying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Redirecting to payment...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              Pay ${amountDollars} Securely
            </>
          )}
        </Button>

        <p className="text-center text-xs text-gray-400">
          Powered by Stripe · Your payment is encrypted and secure
        </p>

        {/* Contact fallback */}
        {data.businessPhone && (
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Need help?</p>
            <a href={`tel:${data.businessPhone}`} className="text-sm text-blue-600 font-medium">
              Call {data.businessName}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
