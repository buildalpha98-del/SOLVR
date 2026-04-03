/**
 * Privacy Policy — Solvr
 * Compliant with Australian Privacy Act 1988 and APPs
 * Effective April 2026
 */

import { Link } from "wouter";

export default function Privacy() {
  const effectiveDate = "3 April 2026";
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
              Solvr ("we", "us", "our") is committed to protecting your personal information in accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs). This Privacy Policy explains how we collect, use, store, and disclose your personal information when you use our website at <strong>{website}</strong> or engage our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">2. What Information We Collect</h2>
            <p>We may collect the following types of personal information:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong>Contact information:</strong> name, email address, phone number, and business name — collected when you submit an enquiry, book a strategy call, or sign up for our services.</li>
              <li><strong>Business information:</strong> details about your business, workflows, and operations — provided by you during consultations or onboarding.</li>
              <li><strong>Usage data:</strong> information about how you interact with our website, including pages visited, time spent, and referring URLs — collected automatically via analytics tools.</li>
              <li><strong>Voice and call data:</strong> if you use our AI voice agent service, call recordings and transcripts may be processed to deliver and improve the service.</li>
              <li><strong>Payment information:</strong> billing details processed securely through our payment provider (Stripe). We do not store your full card details.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">3. How We Use Your Information</h2>
            <p>We use your personal information to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Deliver the services you have requested or subscribed to</li>
              <li>Respond to your enquiries and communicate with you about your account</li>
              <li>Process payments and manage billing</li>
              <li>Send you relevant updates, newsletters, or marketing communications (you may opt out at any time)</li>
              <li>Improve our website, services, and AI tools</li>
              <li>Comply with our legal obligations</li>
            </ul>
            <p className="mt-3">
              We will never use your confidential business data to train AI models without your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">4. How We Share Your Information</h2>
            <p>
              We do not sell your personal information. We may share your information with trusted third-party service providers who assist us in delivering our services, including:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong>AI platforms</strong> (e.g. OpenAI, Anthropic) — to process requests and deliver AI-powered features</li>
              <li><strong>Automation tools</strong> (e.g. Zapier, Make) — to run automated workflows on your behalf</li>
              <li><strong>Payment processors</strong> (e.g. Stripe) — to process subscription and one-off payments</li>
              <li><strong>Analytics providers</strong> — to understand how our website is used</li>
              <li><strong>Communication tools</strong> (e.g. email platforms) — to send you notifications and updates</li>
            </ul>
            <p className="mt-3">
              All third-party providers are required to handle your information in accordance with applicable privacy laws. We may also disclose your information where required by law or to protect our legal rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">5. Data Storage and Security</h2>
            <p>
              Your personal information is stored on secure servers located in Australia and the United States. We implement industry-standard security measures including encryption in transit (HTTPS), access controls, and regular security reviews to protect your data from unauthorised access, disclosure, or loss.
            </p>
            <p className="mt-3">
              While we take reasonable steps to protect your information, no method of transmission over the internet is 100% secure. If you believe your information has been compromised, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">6. Cookies and Tracking</h2>
            <p>
              Our website uses cookies and similar tracking technologies to improve your experience and analyse site usage. You can control cookie settings through your browser. Disabling cookies may affect some functionality of our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">7. Your Rights</h2>
            <p>Under the Australian Privacy Principles, you have the right to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong>Access</strong> the personal information we hold about you</li>
              <li><strong>Correct</strong> inaccurate or out-of-date information</li>
              <li><strong>Request deletion</strong> of your personal information (subject to legal obligations)</li>
              <li><strong>Opt out</strong> of marketing communications at any time</li>
              <li><strong>Lodge a complaint</strong> with the Office of the Australian Information Commissioner (OAIC) at <a href="https://www.oaic.gov.au" target="_blank" rel="noopener noreferrer" className="text-[#F5A623] hover:underline">oaic.gov.au</a> if you believe we have breached the APPs</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at <a href={`mailto:${email}`} className="text-[#F5A623] hover:underline">{email}</a>. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">8. Retention</h2>
            <p>
              We retain your personal information for as long as necessary to deliver our services and comply with our legal obligations. When your information is no longer required, we will securely delete or de-identify it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">9. Children's Privacy</h2>
            <p>
              Our services are not directed at children under the age of 18. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such information, please contact us and we will delete it promptly.
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
              For any privacy-related questions, requests, or complaints, please contact us at:{" "}
              <a href={`mailto:${email}`} className="text-[#F5A623] hover:underline">{email}</a>
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
