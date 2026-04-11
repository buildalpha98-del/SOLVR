/**
 * Privacy Policy — Solvr
 * Compliant with Australian Privacy Act 1988 and APPs
 * Updated for Apple App Store submission — April 2026
 */

import { Link } from "wouter";

export default function Privacy() {
  const effectiveDate = "11 April 2026";
  const abn = "47 262 120 626";
  const email = "hello@solvr.com.au";
  const website = "solvr.com.au";

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100 py-4 px-6">
        <Link href="/" className="font-bold text-[#0F1F3D] text-lg hover:text-[#F5A623] transition-colors">
          ← Back to Solvr
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-[#0F1F3D] mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-10">Effective date: {effectiveDate}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">1. Our Commitment to Privacy</h2>
            <p>
              Solvr ("we", "us", "our") is operated by Elevate Kids Holdings Pty Ltd (ABN {abn}). We are committed to protecting your personal information in accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs). This Privacy Policy explains how we collect, use, store, and disclose your personal information when you use our website at <strong>{website}</strong>, our mobile application, or engage our AI receptionist and quoting services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">2. What Information We Collect</h2>
            <p>We collect the following categories of personal information:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong>Account and contact information:</strong> name, email address, phone number, and business name — collected when you register, book a call, or sign up for our services.
              </li>
              <li>
                <strong>Business details:</strong> your trade type, service area, pricing, and operational information — provided during onboarding and used to configure your AI receptionist.
              </li>
              <li>
                <strong>Call recordings and transcripts:</strong> when your AI receptionist handles inbound calls, those calls are recorded and transcribed to extract job bookings and quotes. Recordings are stored securely and used solely to deliver the service.
              </li>
              <li>
                <strong>Photos and files uploaded to quotes:</strong> images of job sites or materials that you upload when creating a quote are stored securely in cloud storage.
              </li>
              <li>
                <strong>Device push notification tokens:</strong> if you enable push notifications in our mobile app, we store your device token to deliver job alerts and booking confirmations. You can withdraw consent at any time in your device settings.
              </li>
              <li>
                <strong>Payment and billing information:</strong> billing details are processed securely through Stripe. We store only a Stripe customer ID — we never store full card numbers or CVV codes.
              </li>
              <li>
                <strong>Usage data:</strong> pages visited, features used, and device/browser information — collected automatically to improve the service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">3. How We Use Your Information</h2>
            <p>We use your personal information to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Operate and deliver the AI receptionist, voice-to-quote, and job management services you have subscribed to</li>
              <li>Process payments and manage your subscription</li>
              <li>Send you job booking alerts, invoice notifications, and service updates</li>
              <li>Respond to your support requests</li>
              <li>Improve our AI models and service quality (using anonymised, aggregated data only — we will never use your identifiable business data to train AI models without your explicit written consent)</li>
              <li>Comply with our legal obligations under Australian law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">4. Third-Party Service Providers</h2>
            <p>
              We do not sell your personal information. We share data only with the following trusted third-party processors, each bound by their own privacy policies and applicable law:
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border border-gray-200 font-semibold text-[#0F1F3D]">Provider</th>
                    <th className="text-left p-3 border border-gray-200 font-semibold text-[#0F1F3D]">Purpose</th>
                    <th className="text-left p-3 border border-gray-200 font-semibold text-[#0F1F3D]">Data Shared</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border border-gray-200"><strong>OpenAI</strong></td>
                    <td className="p-3 border border-gray-200">Call transcription and quote extraction (AI processing)</td>
                    <td className="p-3 border border-gray-200">Call transcripts, job notes</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 border border-gray-200"><strong>Vapi</strong></td>
                    <td className="p-3 border border-gray-200">AI voice agent — handles inbound calls on your behalf</td>
                    <td className="p-3 border border-gray-200">Call audio, caller phone number</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-gray-200"><strong>Amazon Web Services (AWS S3)</strong></td>
                    <td className="p-3 border border-gray-200">Secure file storage for call recordings, quote photos, and PDFs</td>
                    <td className="p-3 border border-gray-200">Uploaded files and recordings</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 border border-gray-200"><strong>Stripe</strong></td>
                    <td className="p-3 border border-gray-200">Payment processing and subscription billing</td>
                    <td className="p-3 border border-gray-200">Name, email, billing details</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-gray-200"><strong>Expo (Expo Push Notifications)</strong></td>
                    <td className="p-3 border border-gray-200">Delivering push notifications to the mobile app</td>
                    <td className="p-3 border border-gray-200">Device push token</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 border border-gray-200"><strong>Resend</strong></td>
                    <td className="p-3 border border-gray-200">Transactional email delivery (quotes, invoices, alerts)</td>
                    <td className="p-3 border border-gray-200">Name, email address</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              All providers are required to handle your information in accordance with applicable privacy laws. We may also disclose your information where required by law or court order.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">5. Data Storage and Security</h2>
            <p>
              Your personal information is stored on secure servers located in Australia and the United States (AWS ap-southeast-2 and us-east-1 regions). We implement industry-standard security measures including TLS encryption in transit, AES-256 encryption at rest, access controls, and regular security reviews.
            </p>
            <p className="mt-3">
              While we take all reasonable steps to protect your information, no transmission over the internet is 100% secure. If you believe your account has been compromised, contact us immediately at <a href={`mailto:${email}`} className="text-[#F5A623] hover:underline">{email}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">6. Cookies and Tracking</h2>
            <p>
              Our website uses session cookies for authentication and analytics cookies to understand how the service is used. You can control cookie settings through your browser. Disabling cookies may prevent you from logging in to the portal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">7. Your Rights — Access, Correction, and Deletion</h2>
            <p>Under the Australian Privacy Principles, you have the right to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong>Access</strong> the personal information we hold about you</li>
              <li><strong>Correct</strong> inaccurate or out-of-date information</li>
              <li><strong>Request deletion</strong> of your personal information and account data</li>
              <li><strong>Opt out</strong> of marketing communications at any time via the unsubscribe link in any email</li>
              <li><strong>Withdraw consent</strong> for push notifications at any time in your device settings</li>
              <li><strong>Lodge a complaint</strong> with the Office of the Australian Information Commissioner (OAIC) at <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-[#F5A623] hover:underline">oaic.gov.au</a></li>
            </ul>
            <div className="mt-4 p-4 rounded-lg border border-[#F5A623]/30 bg-[#F5A623]/05">
              <p className="font-semibold text-[#0F1F3D] mb-1">How to request data deletion</p>
              <p>
                To request deletion of your account and all associated personal data (including call recordings, uploaded files, and business information), send an email to <a href={`mailto:${email}`} className="text-[#F5A623] hover:underline">{email}</a> with the subject line <strong>"Data Deletion Request"</strong> and include your registered email address. We will confirm receipt within 2 business days and complete the deletion within 30 days, subject to any legal retention obligations.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">8. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to deliver our services. Call recordings are retained for 12 months unless you request earlier deletion. When your information is no longer required, we will securely delete or de-identify it. Stripe billing records may be retained for up to 7 years to comply with Australian tax law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">9. Children's Privacy</h2>
            <p>
              Our services are directed at business owners and are not intended for use by children under 18. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such information, contact us and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the updated policy on our website with a new effective date. Your continued use of our services after the effective date constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">11. Contact Us</h2>
            <p>
              For any privacy-related questions, access requests, correction requests, or data deletion requests, please contact us at:
            </p>
            <div className="mt-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
              <p className="font-semibold text-[#0F1F3D]">Solvr — Privacy Officer</p>
              <p>Email: <a href={`mailto:${email}`} className="text-[#F5A623] hover:underline">{email}</a></p>
              <p>Website: <a href={`https://${website}`} className="text-[#F5A623] hover:underline">{website}</a></p>
              <p>ABN: {abn}</p>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              We will respond to all privacy enquiries within 30 days. If you are not satisfied with our response, you may lodge a complaint with the OAIC at <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-[#F5A623] hover:underline">oaic.gov.au</a>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex gap-6 text-sm text-gray-500">
          <Link href="/terms" className="hover:text-[#F5A623] transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-[#F5A623] transition-colors">Back to Home</Link>
        </div>
      </main>
    </div>
  );
}
