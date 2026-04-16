import BlogPostPage from "@/components/BlogPostPage";
import { blogPosts } from "@/data/blogPosts";

const post = blogPosts.find((p) => p.slug === "how-to-quote-faster-as-a-tradie")!;

const s = {
  navy: "#0F1F3D",
  amber: "#F5A623",
  warmWhite: "#FAFAF8",
  lightGrey: "#F0EFE8",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, color: s.navy, marginTop: 48, marginBottom: 16, lineHeight: 1.25 }}>
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 20, color: s.navy, marginTop: 36, marginBottom: 12 }}>
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 20 }}>{children}</p>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: s.lightGrey, borderLeft: `4px solid ${s.amber}`, borderRadius: 8, padding: "16px 20px", margin: "28px 0", fontSize: 15, color: "#4A5568", lineHeight: 1.7 }}>
      {children}
    </div>
  );
}

function Tip({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, padding: "28px 28px", marginBottom: 24, borderLeft: `4px solid ${s.amber}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ background: s.navy, color: s.amber, fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {number}
        </div>
        <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 19, color: s.navy, margin: 0 }}>{title}</h3>
      </div>
      <div style={{ fontSize: 15, color: "#4A5568", lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

export default function HowToQuoteFaster() {
  return (
    <BlogPostPage post={post}>
      <P>
        The average Australian tradie spends between 30 and 60 minutes writing a single quote. Multiply that by 3–5 quotes a week and you're losing up to 5 hours every week to paperwork — time that could be spent on the tools, with your family, or winning more work.
      </P>
      <P>
        The good news is that quoting speed is almost entirely a systems problem, not a skills problem. With the right approach, most tradies can get a professional, detailed quote out the door in under 5 minutes. The best can do it in under 30 seconds.
      </P>
      <P>
        Here are 7 techniques that are working for Australian tradies right now.
      </P>

      <Callout>
        <strong>The core insight:</strong> Every minute you spend writing a quote is a minute you're not on the tools. The tradie who quotes fastest wins the job — because the customer is still standing in front of you when the quote lands in their inbox.
      </Callout>

      <H2>Why quoting speed matters more than you think</H2>
      <P>
        Research from the Australian Small Business and Family Enterprise Ombudsman consistently shows that speed of response is one of the top three factors customers use to choose a tradie — ahead of price in many cases. A customer who gets a quote within 10 minutes of a site visit is significantly more likely to accept it than one who receives the same quote two days later.
      </P>
      <P>
        The psychology is straightforward: when you quote quickly, you signal competence, organisation, and respect for the customer's time. When you take days, the customer has already called three other tradies and is comparing prices — and you've lost the advantage of being there in person.
      </P>

      <Tip number={1} title="Build a price book and use it every time">
        <p style={{ marginBottom: 12 }}>
          The single biggest time sink in quoting is looking up prices. If you're opening spreadsheets, calling suppliers, or trying to remember what you charged last time, you're adding 15–20 minutes to every quote.
        </p>
        <p style={{ marginBottom: 12 }}>
          A price book is a pre-built list of your most common labour rates, materials, and job types with your standard pricing already set. Every quoting app worth using supports price books. Set yours up once, keep it updated quarterly, and your quotes become a matter of selecting items rather than calculating from scratch.
        </p>
        <p>
          Start with your 20 most common line items — these will cover 80% of your jobs. Add to it as you quote new job types.
        </p>
      </Tip>

      <Tip number={2} title="Quote on-site, not back at the office">
        <p style={{ marginBottom: 12 }}>
          The old workflow — take notes on-site, drive back, type up the quote, email it — adds hours of delay and introduces transcription errors. The customer has moved on by the time the quote arrives.
        </p>
        <p style={{ marginBottom: 12 }}>
          Modern quoting apps let you build and send a quote from your phone while you're still standing in the customer's kitchen. The customer gets the quote before you've driven away. This alone dramatically improves acceptance rates.
        </p>
        <p>
          If your current quoting tool requires a desktop or laptop, it's time to switch to one that's built for mobile.
        </p>
      </Tip>

      <Tip number={3} title="Use voice quoting to eliminate typing entirely">
        <p style={{ marginBottom: 12 }}>
          Typing on a phone screen while wearing work gloves is painful. Voice quoting eliminates the problem entirely. You speak the job description — "supply and install 15 metres of copper pipe, two isolation valves, labour 3 hours" — and the app generates the itemised quote automatically.
        </p>
        <p style={{ marginBottom: 12 }}>
          This is the technology Solvr is built around. A tradie can speak a full job description in 20–30 seconds and have a branded, GST-ready PDF quote ready to send before the customer has walked them to the door.
        </p>
        <p>
          No typing. No transcription. No delay.
        </p>
      </Tip>

      <Tip number={4} title="Create job templates for your most common work">
        <p style={{ marginBottom: 12 }}>
          If you do the same types of jobs regularly — hot water system replacement, switchboard upgrade, bathroom renovation — create a quote template for each one. A template pre-fills the standard line items, labour rates, and terms. You adjust quantities and add any job-specific items, then send.
        </p>
        <p>
          A good template can take a 45-minute quoting job down to under 5 minutes. Most tradies have 5–10 job types that make up 70% of their work. Build a template for each one.
        </p>
      </Tip>

      <Tip number={5} title="Set your payment terms and conditions once — and stop rewriting them">
        <p style={{ marginBottom: 12 }}>
          Many tradies waste time rewriting their terms and conditions on every quote. Set your standard terms once in your quoting app — deposit percentage, payment due date, warranty terms, cancellation policy — and they'll appear automatically on every quote you send.
        </p>
        <p>
          This also protects you legally. Having your terms in writing on every quote is far better than a verbal agreement that's impossible to enforce.
        </p>
      </Tip>

      <Tip number={6} title="Follow up automatically — don't chase manually">
        <p style={{ marginBottom: 12 }}>
          Sending the quote is only half the job. Most tradies send a quote and then either forget to follow up or spend time manually chasing customers. Automated follow-up sequences — a reminder at 24 hours, another at 72 hours — can lift acceptance rates by 20–30% without any extra effort.
        </p>
        <p>
          Set up automated SMS or email follow-ups in your quoting app. When a customer hasn't responded in 24 hours, they get a friendly reminder. You don't have to remember to send it.
        </p>
      </Tip>

      <Tip number={7} title="Measure your quote-to-acceptance rate and improve it">
        <p style={{ marginBottom: 12 }}>
          If you don't know your acceptance rate, you can't improve it. Most tradies have no idea what percentage of their quotes are accepted — and therefore no way to know if their pricing, speed, or presentation is the problem.
        </p>
        <p style={{ marginBottom: 12 }}>
          A good quoting app tracks this automatically. The industry average for tradie quote acceptance is around 40–50%. If you're below that, the issue is usually one of three things: price too high, quote too slow, or presentation too unprofessional.
        </p>
        <p>
          Track your rate monthly. If it drops, investigate why. If it improves, understand what changed and do more of it.
        </p>
      </Tip>

      <H2>The fastest quoting workflow in 2026</H2>
      <P>
        Combining all seven techniques, the fastest quoting workflow for a tradie in 2026 looks like this: you arrive on-site, assess the job, open your quoting app, speak the job description into your phone, review the auto-generated line items from your price book, adjust quantities if needed, and hit send. The customer receives a branded PDF quote while you're still on-site. Total time: under 2 minutes.
      </P>
      <P>
        This isn't hypothetical — it's what tradies using voice quoting tools are doing right now. The technology exists. The question is whether you're using it.
      </P>

      <H2>What to look for in a quoting app</H2>
      <P>
        Not all quoting apps are equal. When evaluating options, prioritise these features:
      </P>

      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: s.navy }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Feature</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Why it matters</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Mobile-first design", "You're quoting on-site, not at a desk. The app must work perfectly on a phone."],
              ["Price book support", "Pre-built pricing eliminates the biggest time sink in quoting."],
              ["Voice input", "Eliminates typing — the fastest way to create a quote on-site."],
              ["Branded PDF output", "Professional presentation improves acceptance rates."],
              ["Automated follow-up", "Chasing quotes manually costs time and often doesn't happen."],
              ["Xero / MYOB sync", "Avoids double-entry when converting quotes to invoices."],
              ["Acceptance tracking", "You can't improve what you don't measure."],
            ].map(([feature, why], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F0EFE8", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600, color: s.navy }}>{feature}</td>
                <td style={{ padding: "12px 16px", color: "#4A5568" }}>{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>The bottom line</H2>
      <P>
        Quoting faster isn't about cutting corners — it's about removing the friction between assessing a job and getting a professional quote in front of the customer. Every minute of delay is a minute the customer is considering someone else.
      </P>
      <P>
        The tradies winning the most work in 2026 aren't necessarily the cheapest or the most experienced. They're the ones who respond fastest, present most professionally, and follow up most consistently. All of that is achievable with the right systems.
      </P>
      <P>
        Start with a price book. Move to mobile quoting. Add voice input when you're ready. Measure your acceptance rate. Improve it. That's the entire playbook.
      </P>
    </BlogPostPage>
  );
}
