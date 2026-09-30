import BlogPostPage from "@/components/BlogPostPage";
import { blogPosts } from "@/data/blogPosts";

const post = blogPosts.find(p => p.slug === "how-to-reduce-tradie-no-shows")!;

const s = {
  navy: "#0F1F3D",
  amber: "#F5A623",
  lightGrey: "#F0EFE8",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "'Syne', sans-serif",
        fontWeight: 800,
        fontSize: 26,
        color: s.navy,
        marginTop: 48,
        marginBottom: 16,
        lineHeight: 1.25,
      }}
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: "'Syne', sans-serif",
        fontWeight: 700,
        fontSize: 20,
        color: s.navy,
        marginTop: 34,
        marginBottom: 12,
      }}
    >
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 20 }}>{children}</p>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: s.lightGrey,
        borderLeft: `4px solid ${s.amber}`,
        borderRadius: 8,
        padding: "16px 20px",
        margin: "28px 0",
        fontSize: 15,
        color: "#4A5568",
        lineHeight: 1.7,
      }}
    >
      {children}
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E8E6DE",
        borderRadius: 14,
        padding: "26px 28px",
        marginBottom: 22,
        borderLeft: `4px solid ${s.amber}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            background: s.navy,
            color: s.amber,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 18,
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {number}
        </div>
        <h3
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: 19,
            color: s.navy,
            margin: 0,
          }}
        >
          {title}
        </h3>
      </div>
      <div style={{ fontSize: 15, color: "#4A5568", lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  );
}

export default function HowToReduceTradieNoShows() {
  return (
    <BlogPostPage post={post}>
      <P>
        A customer who does not show up can cost a tradie far more than one
        wasted appointment. You lose the travel time, the gap in your schedule,
        the chance to take another job and the momentum of a day that was
        planned around the visit. For a small trade business, a few no-shows
        each week quickly become a real margin problem.
      </P>
      <P>
        The good news is that most no-shows are preventable. Customers forget,
        misunderstand the arrival window, cannot get access ready or stop
        treating the booking as important because nobody confirms it. A simple
        confirmation system removes much of that friction without forcing you to
        chase every customer manually.
      </P>
      <Callout>
        <strong>The practical rule:</strong> Confirm the booking when it is
        made, remind the customer before the appointment, and make it easy for
        them to reschedule rather than disappear.
      </Callout>

      <H2>What counts as a no-show?</H2>
      <P>
        A no-show is not only a customer who is completely absent. It also
        includes jobs where you arrive and cannot start because the customer is
        unavailable, the property is locked, the tenant was not told, the
        vehicle cannot access the site or the decision-maker is missing. If the
        booked time cannot turn into productive work, it belongs in your no-show
        or failed-attendance numbers.
      </P>
      <P>
        Track late cancellations separately. They may feel less frustrating than
        an empty property, but a cancellation two hours before arrival can leave
        the same hole in your day. The reason matters because the fix is
        different: reminders may prevent forgetfulness, while a deposit or
        clearer cancellation policy may reduce low-commitment bookings.
      </P>
      <div
        style={{
          background: "#fff",
          border: "1px solid #E8E6DE",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 28,
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <thead>
            <tr style={{ background: s.navy }}>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Problem
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                What the tradie experiences
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Likely fix
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                "Forgotten appointment",
                "You arrive to an empty property.",
                "Automated SMS or email reminders.",
              ],
              [
                "Late cancellation",
                "The slot is too short to refill.",
                "Clear cancellation terms and a deposit where appropriate.",
              ],
              [
                "Access failure",
                "The customer is home but the job cannot start.",
                "Confirm keys, parking, pets and access instructions.",
              ],
              [
                "Wrong expectation",
                "The customer expects a different service or duration.",
                "Repeat the scope, arrival window and preparation steps.",
              ],
            ].map(([a, b, c], i) => (
              <tr
                key={i}
                style={{
                  borderBottom: "1px solid #F0EFE8",
                  background: i % 2 === 0 ? "#fff" : "#FAFAF8",
                }}
              >
                <td
                  style={{
                    padding: "12px 16px",
                    fontWeight: 700,
                    color: s.navy,
                  }}
                >
                  {a}
                </td>
                <td style={{ padding: "12px 16px", color: "#4A5568" }}>{b}</td>
                <td style={{ padding: "12px 16px", color: "#4A5568" }}>{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Why no-shows happen in trade businesses</H2>
      <P>
        Customers are managing work, school, appointments and competing
        commitments. They may genuinely intend to be there and still forget. A
        booking made several days earlier is not top of mind, especially when
        the customer does not have a calendar invite or a clear arrival window.
      </P>
      <P>
        Some customers also do not understand what they need to do before you
        arrive. A plumber may need access to a meter or isolation valve. An
        electrician may need the switchboard accessible. A painter may need
        furniture moved. A builder may need the site cleared. If those details
        are not confirmed, the customer can think the booking is ready when it
        is not.
      </P>
      <P>
        Finally, some bookings are low commitment because the customer has not
        accepted a clear scope, price or cancellation expectation. Your process
        should make the next action obvious: confirm the time, approve the
        quote, pay the deposit if required and reply if plans change.
      </P>

      <H2>Build a confirmation process that works</H2>
      <Step number={1} title="Capture the right contact details">
        <P>
          Ask for the customer’s preferred mobile number and email address when
          the job is booked. Confirm the spelling of the name, the service
          address and whether someone else, such as a tenant, property manager
          or site supervisor, must receive the reminder.
        </P>
        <P>
          Do not rely on a note in your phone. Store the details against the job
          so every team member sees the same information and the reminder can be
          sent from the same record as the booking.
        </P>
      </Step>
      <Step number={2} title="Send an immediate booking confirmation">
        <P>
          The first message should be sent while the customer still remembers
          the conversation. Include the date, arrival window, service address,
          job description, expected duration and any preparation required. If
          the booking is provisional, label it as provisional rather than making
          the customer guess.
        </P>
        <P>
          A useful confirmation is short enough to read on a phone. For example:
          “Your booking with Smith Plumbing is confirmed for Tuesday 14 October,
          8:00–10:00 am, at 12 Example Street. Please make sure the meter and
          under-sink area are accessible. Reply to this message if you need to
          change the time.”
        </P>
      </Step>
      <Step number={3} title="Remind the customer at the right time">
        <P>
          For most planned work, send a reminder 24 hours before the
          appointment. For early-morning jobs, an additional reminder the
          afternoon before can help. For urgent service, a same-day arrival
          message is more useful than a reminder sent after the customer has
          already forgotten the booking.
        </P>
        <P>
          Do not send five generic messages. The goal is certainty, not noise.
          The message should tell the customer what is happening and give them a
          simple way to flag a problem.
        </P>
      </Step>
      <Step number={4} title="Ask for an active confirmation">
        <P>
          An active reply such as “Y” or “CONFIRM” gives you a stronger signal
          than an unread message. You can also ask the customer to reply with
          access instructions or confirm that someone will be present.
        </P>
        <P>
          For higher-value or longer bookings, make confirmation part of the
          process. If the customer does not respond by a stated cut-off, call
          them or offer the slot to another customer. Be consistent rather than
          threatening a policy you will not enforce.
        </P>
      </Step>
      <Step number={5} title="Make rescheduling easy">
        <P>
          Customers are more likely to tell you their plans changed if the
          alternative is simple. Give them a phone number, reply option or
          booking link. A customer who reschedules is still a customer; a
          customer who cannot reach you may simply book someone else.
        </P>
      </Step>

      <H2>What to include in a tradie appointment reminder</H2>
      <P>
        A reminder should answer the questions a customer would otherwise call
        to ask. Include the arrival window rather than promising an exact minute
        when traffic and earlier jobs make that unrealistic. Name the service
        clearly so the customer can spot a wrong booking. State the address,
        access requirements and any items they need to prepare.
      </P>
      <P>
        For jobs involving parts or materials, explain whether the visit is an
        assessment, a repair or an installation. If the quote is conditional on
        inspection, say that. Clear wording protects both sides from the
        customer assuming a full replacement is included when you booked a
        diagnostic visit.
      </P>
      <Callout>
        <strong>Reminder checklist:</strong> customer name, trade business name,
        date, arrival window, address, job scope, preparation or access
        requirements, cancellation or deposit terms, and a clear reply or call
        option.
      </Callout>

      <H2>Should you charge a cancellation fee or deposit?</H2>
      <P>
        A fee is not the first answer to every no-show. Start by fixing unclear
        communication and making the booking easy to manage. A cancellation fee
        or deposit makes more sense when the job reserves substantial time,
        requires special-order materials, involves a crew or has a history of
        late cancellations.
      </P>
      <P>
        Put the terms in writing before the customer accepts the booking.
        Explain the notice period, the amount, when it is refundable and what
        happens if you need to reschedule. Apply the policy consistently and
        reasonably. The aim is to protect a reserved slot, not create an
        argument over a genuine emergency.
      </P>
      <div
        style={{
          background: "#fff",
          border: "1px solid #E8E6DE",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 28,
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <thead>
            <tr style={{ background: s.navy }}>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Booking type
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Reasonable protection
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                What to communicate
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                "Short service call",
                "Confirmation and reminder.",
                "Arrival window, access and rescheduling.",
              ],
              [
                "Full-day or crew booking",
                "Deposit or cancellation terms may be appropriate.",
                "Notice period and reserved capacity.",
              ],
              [
                "Special-order materials",
                "Deposit covering agreed materials.",
                "What is refundable and when materials are ordered.",
              ],
              [
                "Repeat late cancellations",
                "Require confirmation before holding a new slot.",
                "The reason for the change and the next booking conditions.",
              ],
            ].map(([a, b, c], i) => (
              <tr
                key={i}
                style={{
                  borderBottom: "1px solid #F0EFE8",
                  background: i % 2 === 0 ? "#fff" : "#FAFAF8",
                }}
              >
                <td
                  style={{
                    padding: "12px 16px",
                    fontWeight: 700,
                    color: s.navy,
                  }}
                >
                  {a}
                </td>
                <td style={{ padding: "12px 16px", color: "#4A5568" }}>{b}</td>
                <td style={{ padding: "12px 16px", color: "#4A5568" }}>{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>
        Check your customer terms and get professional advice for your business
        and state before introducing fees. The customer should know the
        arrangement before the appointment is locked in, not after missing it.
      </P>

      <H2>Use your schedule to reduce the damage</H2>
      <P>
        Even a good process will not eliminate every no-show. Protect the
        schedule by keeping a short-notice list of customers who want earlier
        availability. When someone cancels, contact those customers quickly
        rather than starting from zero.
      </P>
      <P>
        Group jobs by area where possible, leave realistic travel buffers and
        avoid filling every minute with a hard commitment. A small amount of
        planned flexibility helps you absorb traffic, late arrivals and
        cancellations without turning the whole day into overtime.
      </P>
      <P>
        For a team, give the office or field supervisor a simple status:
        confirmed, needs confirmation, reschedule requested, cancelled or
        no-show. That makes it possible to act before a technician drives across
        town for a booking that was never properly accepted.
      </P>

      <H2>Measure the problem every month</H2>
      <P>
        You cannot improve what you only remember anecdotally. At the end of
        each month, count completed jobs, late cancellations, no-shows and
        failed attendances. Break the number down by booking source, job type,
        customer type and team member if the sample is large enough to be
        useful.
      </P>
      <P>
        Calculate the direct cost by multiplying failed attendance time by the
        labour rate, then add travel and the likely contribution margin from the
        job you could not replace. You do not need an elaborate dashboard. A
        simple monthly table will show whether reminders, deposits or better
        scope confirmation are changing the result.
      </P>
      <Callout>
        <strong>One useful target:</strong> reduce preventable failed
        attendances first. Do not punish the team for unavoidable emergencies or
        access problems they documented properly; fix the process that creates
        repeatable failures.
      </Callout>

      <H2>The bottom line</H2>
      <P>
        Reducing no-shows is a customer communication problem before it is a
        customer discipline problem. Confirm bookings immediately, remind
        customers at a sensible time, repeat the access requirements and make
        rescheduling easy. For high-value or high-risk bookings, use clear
        deposits and cancellation terms that the customer sees before accepting.
      </P>
      <P>
        Solvr helps Australian tradies keep job details, customer communication
        and booking information in one workflow, so fewer appointments depend on
        a note in someone’s phone.{" "}
        <strong>
          Start your free trial and spend more of the day doing paid work, not
          chasing confirmations.
        </strong>
      </P>
    </BlogPostPage>
  );
}
