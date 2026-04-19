import BlogPostPage from "@/components/BlogPostPage";
import { blogPosts } from "@/data/blogPosts";

const post = blogPosts.find((p) => p.slug === "ai-receptionist-for-tradies")!;

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

function StatBlock({ stat, label }: { stat: string; label: string }) {
  return (
    <div style={{ background: s.navy, borderRadius: 12, padding: "24px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 36, color: s.amber, marginBottom: 8 }}>{stat}</div>
      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.5 }}>{label}</div>
    </div>
  );
}

export default function AIReceptionist() {
  return (
    <BlogPostPage post={post}>
      <P>
        You're under a sink, both hands full, when your phone rings. You can't answer. The call goes to voicemail. The customer — who found you on Google and was ready to book — hears a generic voicemail message and hangs up. They call the next tradie on the list.
      </P>
      <P>
        This happens to the average Australian tradie 3–5 times every working day. At a conservative estimate of $300 per job, that's $900–$1,500 in potential revenue walking out the door every day — not because you're not good enough, but because you were busy doing the job you were already paid for.
      </P>
      <P>
        An AI receptionist solves this problem. Here's how it works, what it can and can't do, and whether it's worth it for your business.
      </P>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, margin: "36px 0" }}>
        <StatBlock stat="3–5" label="calls missed per day by the average tradie" />
        <StatBlock stat="62%" label="of callers won't leave a voicemail" />
        <StatBlock stat="78%" label="of customers book the first tradie who responds" />
        <StatBlock stat="$1,200" label="estimated daily revenue lost to missed calls" />
      </div>

      <H2>What is an AI receptionist?</H2>
      <P>
        An AI receptionist is a voice agent — software that answers your phone calls, conducts a natural conversation with the caller, and takes action based on what the caller needs. It's not a phone tree ("press 1 for quotes, press 2 for emergencies"). It's a conversational AI that can understand what the caller is saying and respond appropriately.
      </P>
      <P>
        When a call comes in that you can't answer, the AI receptionist picks up. It introduces itself as your business — "Thanks for calling [Your Business Name], I'm here to help" — and handles the conversation from there. Depending on how it's configured, it can answer questions about your services, provide rough pricing guidance, book jobs into your calendar, take a message, or flag urgent calls for immediate callback.
      </P>
      <P>
        After the call, you receive a summary — via SMS or app notification — with the caller's name, number, what they needed, and what action was taken. You're back in control without having missed the opportunity.
      </P>

      <H2>Why tradies specifically benefit from AI receptionists</H2>
      <P>
        Most businesses that use AI receptionists are office-based. For them, it's a convenience — a way to handle overflow calls. For tradies, it's a revenue problem. The nature of trade work means you are physically unable to answer the phone for large portions of the working day. You're on the tools, in a roof cavity, under a house, or driving between jobs. You can't stop what you're doing every time the phone rings.
      </P>
      <P>
        The alternative — hiring a part-time receptionist — costs $25–$35/hour in Australia. A part-time receptionist working 20 hours a week costs $500–$700/week, or $2,000–$2,800/month. For most small trade businesses, that's not viable.
      </P>
      <P>
        An AI receptionist costs a fraction of that, works 24/7, never takes sick days, and doesn't need to be managed. For the specific problem of missed calls, it's a better solution than a human receptionist for most tradie businesses.
      </P>

      <Callout>
        <strong>The maths:</strong> If an AI receptionist recovers just one job per week that would otherwise have been lost to a missed call, and that job is worth $400, that's $1,600/month in recovered revenue. At $49/month for Solvr (which includes the AI receptionist), the ROI is roughly 32:1.
      </Callout>

      <H2>What an AI receptionist can do</H2>
      <H3>Answer calls and conduct natural conversations</H3>
      <P>
        Modern AI receptionists — including Solvr's, which is built on Vapi's voice AI technology — can hold natural, flowing conversations. They understand context, can handle interruptions, and respond to questions they haven't been explicitly programmed for. The experience for the caller is significantly better than a phone tree or a voicemail.
      </P>

      <H3>Answer questions about your services</H3>
      <P>
        You configure the AI with information about your business — what trades you cover, your service area, your rough pricing ranges, your availability. When a caller asks "Do you do hot water systems?" or "Do you cover the Northern Beaches?", the AI answers accurately based on what you've told it.
      </P>

      <H3>Book jobs into your calendar</H3>
      <P>
        The AI can access your calendar and book appointments directly. A caller who wants to book a quote gets a confirmed time slot without any involvement from you. You receive a notification and the booking appears in your calendar.
      </P>

      <H3>Qualify leads</H3>
      <P>
        Not every call is worth your time. The AI can ask qualifying questions — "What type of work do you need done?", "Is this residential or commercial?", "What's your rough timeline?" — and flag high-priority leads for immediate callback while handling lower-priority enquiries with a message.
      </P>

      <H3>Handle after-hours calls</H3>
      <P>
        Customers don't only call during business hours. An AI receptionist handles calls at 7pm, on weekends, and on public holidays — times when you definitely can't answer. For emergency trades (plumbing, electrical), this can be the difference between winning and losing urgent jobs.
      </P>

      <H2>What an AI receptionist can't do</H2>
      <P>
        It's worth being honest about the limitations. An AI receptionist is not a replacement for human judgement in complex situations. It can't diagnose a problem it hasn't been trained on, negotiate pricing, or handle angry or distressed callers as well as an experienced human can. For straightforward booking and enquiry calls — which make up the vast majority of inbound calls for most tradies — it performs extremely well. For complex or emotionally charged situations, it should escalate to a human.
      </P>
      <P>
        The technology is also not perfect. Occasionally it will misunderstand a caller or fail to handle an unusual request. This is rare with modern systems, but it happens. The key is configuring it with clear fallback behaviour — when in doubt, take a message and flag for callback.
      </P>

      <H2>How to set up an AI receptionist for your trade business</H2>
      <P>
        Setting up Solvr's AI receptionist takes about 30 minutes. The process involves:
      </P>

      <div style={{ background: "#fff", border: "1px solid #E8E6DE", borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: s.navy }}>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Step</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>What you do</th>
              <th style={{ padding: "12px 16px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["1", "Configure your business profile", "Tell the AI your business name, trade types, service area, and rough pricing ranges", "10 min"],
              ["2", "Set your availability", "Connect your calendar so the AI knows when you're available for bookings", "5 min"],
              ["3", "Configure call handling rules", "Set when the AI should answer (always, after X rings, after hours only)", "5 min"],
              ["4", "Set up call forwarding", "Forward your business number to Solvr when you can't answer", "5 min"],
              ["5", "Test it", "Call your own number and test the experience", "5 min"],
            ].map(([step, action, detail, time], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F0EFE8", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                <td style={{ padding: "12px 16px", fontWeight: 700, color: s.amber }}>{step}</td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: 600, color: s.navy, marginBottom: 4 }}>{action}</div>
                  <div style={{ color: "#718096", fontSize: 13 }}>{detail}</div>
                </td>
                <td style={{ padding: "12px 16px", color: "#718096", whiteSpace: "nowrap" }}>{time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>The bottom line</H2>
      <P>
        An AI receptionist is not a luxury for a tradie business — it's a revenue protection tool. Every missed call is a potential job lost. The technology to stop that from happening is available, affordable, and takes less than an hour to set up.
      </P>
      <P>
        The tradies who will win the most work in 2026 are the ones who respond fastest. If you're physically unable to answer the phone while you're on the tools — and you are — an AI receptionist is the most practical solution to that problem.
      </P>
      <P>
        Solvr's AI receptionist is included in the standard plan at $49/month. If it recovers one job per week, it pays for itself in the first day of the month.
      </P>
    </BlogPostPage>
  );
}
