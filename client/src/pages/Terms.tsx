/**
 * Copyright (c) 2025-2026 ClearPath AI Agency Pty Ltd. All rights reserved.
 * SOLVR is a trademark of ClearPath AI Agency Pty Ltd.
 * Unauthorised copying or distribution is strictly prohibited.
 *
 * Terms of Service — Solvr
 * ClearPath AI Agency Pty Ltd, Australian law, effective April 2026
 */

import { Link } from "wouter";

export default function Terms() {
  const effectiveDate = "3 April 2026";
  const businessName = "ClearPath AI Agency Pty Ltd, trading as Solvr";
  const abn = "47 262 120 626"; // Elevate Kids Holdings ABN — update to ClearPath ABN when assigned
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
        <h1 className="text-4xl font-bold text-[#0F1F3D] mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-10">Effective date: {effectiveDate}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">1. About Us</h2>
            <p>
              These Terms of Service ("Terms") govern your use of the website at <strong>{website}</strong> and any services provided by <strong>{businessName}</strong> ("we", "us", "our"), a sole trader business operating in Australia. By accessing our website or engaging our services, you agree to be bound by these Terms.
            </p>
            <p className="mt-3">
              For any questions, contact us at <a href={`mailto:${email}`} className="text-[#F5A623] hover:underline">{email}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">2. Services</h2>
            <p>
              Solvr provides AI consulting, implementation, and automation services to small and medium businesses, including but not limited to AI readiness audits, tool implementation, team training, and ongoing AI support retainers. We also offer an AI voice agent service ("Never Miss a Job") for trades and service businesses.
            </p>
            <p className="mt-3">
              The specific scope, deliverables, timeline, and fees for each engagement will be set out in a separate service agreement or proposal provided to you before work commences.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">3. Fees and Payment</h2>
            <p>
              Fees for our services are as quoted in your service agreement or as displayed on our website at the time of purchase. All prices are in Australian Dollars (AUD) and exclusive of GST where applicable.
            </p>
            <p className="mt-3">
              For subscription services (including the AI voice agent), fees are billed monthly or annually in advance. Subscriptions will automatically renew at the end of each billing period unless cancelled in accordance with clause 5 below.
            </p>
            <p className="mt-3">
              Payment is due within 7 days of invoice unless otherwise agreed in writing. We reserve the right to suspend services for overdue accounts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">4. Free Trials</h2>
            <p>
              Where a free trial period is offered, you will not be charged during the trial. At the end of the trial, your subscription will automatically commence at the applicable rate unless you cancel before the trial ends. We will provide notice of the trial end date at sign-up.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">5. Cancellation and Refunds</h2>
            <p>
              You may cancel a subscription at any time by contacting us at <a href={`mailto:${email}`} className="text-[#F5A623] hover:underline">{email}</a>. Cancellations take effect at the end of the current billing period. We do not provide refunds for partial billing periods.
            </p>
            <p className="mt-3">
              For one-off project engagements, cancellation terms will be set out in your service agreement. Where no cancellation terms are specified, work completed up to the date of cancellation will be invoiced at our standard rates.
            </p>
            <p className="mt-3">
              If you are not satisfied with our services, please contact us within 14 days of delivery and we will work with you in good faith to resolve the issue.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">6. Intellectual Property</h2>
            <p>
              All content on this website — including text, graphics, logos, and software — is owned by or licensed to Solvr and is protected by Australian copyright law. You may not reproduce, distribute, or create derivative works without our prior written consent.
            </p>
            <p className="mt-3">
              Work product created specifically for you under a service agreement (such as custom AI prompts, workflows, or documentation) becomes your property upon full payment of the applicable fees.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">7. Confidentiality</h2>
            <p>
              We treat all information you share with us as confidential. We will not disclose your business information, data, or materials to third parties except as required to deliver the services (e.g. to AI tool providers) or as required by law. We will never use your confidential business data to train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by Australian law, Solvr's total liability to you for any claim arising from or related to our services is limited to the fees paid by you in the 3 months preceding the claim.
            </p>
            <p className="mt-3">
              We are not liable for any indirect, incidental, special, or consequential loss or damage, including loss of profits, loss of data, or business interruption, even if we have been advised of the possibility of such damages.
            </p>
            <p className="mt-3">
              Nothing in these Terms excludes, restricts, or modifies any right or remedy, or any guarantee, warranty, or other term or condition, implied or imposed by the Australian Consumer Law that cannot lawfully be excluded or limited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">9. Third-Party Tools and Services</h2>
            <p>
              Our services may involve the use of third-party AI tools and platforms (such as OpenAI, Anthropic, Zapier, and others). Your use of these tools is subject to their own terms of service and privacy policies. We are not responsible for the actions, content, or availability of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">10. Governing Law</h2>
            <p>
              These Terms are governed by the laws of Queensland, Australia. Any disputes arising from these Terms or our services will be subject to the exclusive jurisdiction of the courts of Queensland.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">11. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on our website with a new effective date. Your continued use of our services after the effective date constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F1F3D] mb-3">12. Contact</h2>
            <p>
              For any questions about these Terms, please contact us at{" "}
              <a href={`mailto:${email}`} className="text-[#F5A623] hover:underline">{email}</a>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex gap-6 text-sm text-gray-500">
          <Link href="/privacy" className="hover:text-[#F5A623] transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-[#F5A623] transition-colors">Back to Home</Link>
        </div>
      </main>
    </div>
  );
}
