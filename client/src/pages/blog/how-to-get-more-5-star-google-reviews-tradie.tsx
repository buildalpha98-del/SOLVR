import BlogPostPage from "@/components/BlogPostPage";
import { blogPosts } from "@/data/blogPosts";

const post = blogPosts.find(
  p => p.slug === "how-to-get-more-5-star-google-reviews-tradie"
)!;

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

export default function HowToGetMore5StarGoogleReviewsTradie() {
  return (
    <BlogPostPage post={post}>
      <P>
        When someone searches for a plumber, electrician, builder or painter,
        they are not only comparing prices. They are looking for proof that the
        business turns up, does clean work and handles problems properly. A
        strong Google review profile gives a potential customer confidence
        before they ever call.
      </P>
      <P>
        Getting more 5-star reviews is not about begging customers or offering
        rewards. It comes from delivering a review-worthy experience, asking at
        the right moment and removing the friction between a happy customer and
        the Google review form. The process needs to be simple enough that you
        and your team actually use it after every suitable job.
      </P>
      <Callout>
        <strong>The practical rule:</strong> Ask every satisfied customer at the
        moment the result is clear, send a direct review link, and respond
        professionally to every review you receive.
      </Callout>

      <H2>Why Google reviews matter for tradies</H2>
      <P>
        Reviews influence trust, local search visibility and the customer’s
        decision about who to contact first. A homeowner may not understand the
        technical difference between two electrical or plumbing businesses, but
        they can understand recent comments about punctuality, communication,
        workmanship and tidy handover.
      </P>
      <P>
        Reviews also set expectations. When customers repeatedly mention that
        your team explains options, protects the property and sends clear
        quotes, those details become part of your sales message. A review is
        more persuasive when it describes the experience rather than only saying
        “great job”.
      </P>
      <P>
        Do not treat reviews as a substitute for a good website, accurate
        pricing or reliable operations. They amplify what customers experience.
        A rushed job followed by an aggressive request for five stars will not
        create a durable reputation.
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
                Customer experience
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                What a useful review might mention
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                "Before the job",
                "Fast response, clear quote and a confirmed arrival window.",
              ],
              [
                "During the work",
                "Respectful communication, safe work and updates when scope changes.",
              ],
              [
                "At handover",
                "Testing, photos, clean-up, instructions and an invoice that makes sense.",
              ],
              [
                "After the job",
                "Easy follow-up if a question or minor issue appears.",
              ],
            ].map(([a, b], i) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Set up your Google Business Profile first</H2>
      <P>
        Before asking for reviews, make sure your Google Business Profile is
        accurate and controlled by the business. Check the trading name, phone
        number, website, service areas, opening hours, category and description.
        Add recent project photos that show your standard of work, while
        protecting customer privacy and obtaining permission where needed.
      </P>
      <P>
        Use one profile for the business unless Google’s rules and your
        operating structure clearly support more than one. Duplicate or
        misleading listings can create confusion and split your reviews. If you
        move premises, change your name or operate across locations, resolve the
        profile details before pushing a large review campaign.
      </P>
      <P>
        Claim the profile and give access only to the people who need it. Your
        reputation is a business asset, so keep recovery details and ownership
        documented rather than leaving the account tied to a former employee’s
        personal email.
      </P>

      <H2>Ask at the right moment</H2>
      <P>
        The best time to ask is soon after the customer has experienced the
        outcome they wanted. For a small repair, that might be when the fault is
        fixed and tested. For a renovation, it might be at practical completion
        or after the customer has had time to use the finished space. The exact
        timing depends on your job type, but the principle is consistent: ask
        when satisfaction is visible.
      </P>
      <P>
        Do not ask before the work is complete, and do not ask a customer who is
        clearly unhappy. If there is an unresolved problem, move the
        conversation to service recovery first. A review request sent while a
        customer is waiting for a fix makes the business look tone-deaf.
      </P>
      <Callout>
        <strong>Good timing language:</strong> “Now that we have tested
        everything and you are happy with the result, would you mind sharing
        your experience on Google? It helps local customers know what to expect
        from our team.”
      </Callout>

      <H2>Use a repeatable review request process</H2>
      <Step number={1} title="Define the review-ready moment">
        <P>
          Choose the event that signals the job is complete: customer sign-off,
          final walk-through, payment received, handover message or a follow-up
          call. Train the team to recognise that moment rather than leaving the
          request to memory.
        </P>
      </Step>
      <Step number={2} title="Make the request personal">
        <P>
          A generic blast feels like marketing. Use the customer’s name, mention
          the job and thank them for choosing the business. A short request from
          the technician or owner often feels more genuine than a long automated
          email.
        </P>
      </Step>
      <Step number={3} title="Send a direct Google review link">
        <P>
          Do not make customers search for your business name, choose the right
          listing and then find the review button. Create the direct review link
          from your Business Profile and test it on a phone. Put it in the
          job-completion SMS, email or customer portal.
        </P>
      </Step>
      <Step number={4} title="Ask once, then follow up once">
        <P>
          If the customer does not respond, send one polite reminder after a few
          days. Do not keep sending messages or make the customer feel watched.
          A clear request and a single reminder are enough for most businesses.
        </P>
      </Step>
      <Step number={5} title="Record the request and result">
        <P>
          Keep a simple status against the job: eligible, requested, reviewed or
          service recovery. This stops the same customer being asked by three
          different team members and lets you see whether the process is
          working.
        </P>
      </Step>

      <H2>What should you say in the SMS or email?</H2>
      <P>
        The message should be short, specific and optional. Explain why the
        review helps, but do not tell the customer what rating or wording to
        use. A request for an “honest review” is safer and more credible than a
        command to leave five stars.
      </P>
      <div
        style={{
          background: "#fff",
          border: "1px solid #E8E6DE",
          borderRadius: 14,
          padding: "24px 28px",
          margin: "28px 0",
        }}
      >
        <h3
          style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: 19,
            color: s.navy,
            marginTop: 0,
          }}
        >
          A simple review request
        </h3>
        <p style={{ color: "#4A5568", lineHeight: 1.75, marginBottom: 0 }}>
          “Hi [Name], thanks for choosing [Business] for your [job]. We hope you
          are happy with the result. If you have two minutes, an honest Google
          review would help other local customers choose a reliable tradie:
          [review link]. Thanks again, [Team member].”
        </p>
      </div>
      <P>
        For commercial customers, ask whether the review can mention the project
        type or service area. For residential customers, keep the wording
        natural and avoid including private details in a public request. Do not
        put a review link in an invoice without context; the customer should
        know what they are being asked to do.
      </P>

      <H2>Can you offer a discount for a review?</H2>
      <P>
        Do not buy positive reviews or make a reward conditional on a five-star
        rating. That undermines trust and can conflict with platform rules and
        advertising expectations. A customer should not have to choose between a
        reward and an honest opinion.
      </P>
      <P>
        You can improve the experience for everyone by asking for feedback and
        reviews as part of your normal service process. If you run a customer
        survey, keep private feedback separate from a public Google request and
        make it clear that the customer is free to share an honest view. When in
        doubt, get advice before running an incentive or promotion.
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
                Approach
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Better practice
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                "Ask for five stars",
                "Ask for an honest review after a good handover.",
              ],
              [
                "Offer money for a positive review",
                "Do not condition a reward on rating or sentiment.",
              ],
              [
                "Ask only your favourite customers",
                "Use a consistent, appropriate process for eligible completed jobs.",
              ],
              [
                "Ignore negative feedback",
                "Respond calmly and use it to improve service.",
              ],
            ].map(([a, b], i) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>How to respond to positive reviews</H2>
      <P>
        Reply to positive reviews within a reasonable time and make the response
        specific. Thank the customer, name the service or team member where
        appropriate, and reinforce the standard you want future customers to
        expect. A reply such as “Thanks, Sarah — we are glad the switchboard
        upgrade was completed smoothly and the handover was clear” sounds more
        credible than “Thanks for your review!” on every post.
      </P>
      <P>
        Do not paste the customer’s private address, personal circumstances or
        project cost into a public reply. Keep the tone warm, professional and
        brief. A review response is also visible to people who are deciding
        whether to call you next.
      </P>

      <H2>How to handle a negative review</H2>
      <P>
        Respond once, without arguing. Acknowledge the concern, apologise for
        the experience where appropriate and invite the customer to contact the
        business directly so you can review the job details. Do not reveal
        private information or accuse the reviewer of lying in public.
      </P>
      <P>
        Then investigate the underlying job. Check the quote, messages, site
        notes, photos and invoice. If the business made a mistake, fix it and
        learn from it. If the review is fake, abusive or unrelated, use Google’s
        reporting process rather than trying to retaliate with other accounts.
      </P>
      <Callout>
        <strong>Response template:</strong> “We are sorry this was your
        experience. We take the concern seriously and would like to review the
        job properly. Please contact [business contact] with your job details so
        we can investigate and work towards a resolution.”
      </Callout>

      <H2>Turn reviews into an operating system</H2>
      <P>
        Reviews are most useful when they show patterns. Once a month, read the
        newest reviews with your team and group the comments into themes:
        arrival times, quote clarity, workmanship, tidiness, communication,
        speed and follow-up. Praise the behaviours you want repeated and choose
        one operational improvement when the same complaint appears more than
        once.
      </P>
      <P>
        Use the language customers already use in your website copy and quote
        templates, as long as it is accurate. If customers repeatedly mention
        “clear options” or “left the site spotless”, those are valuable proof
        points. Do not manufacture testimonials or rewrite a review to make it
        sound better.
      </P>
      <P>
        Track the number of completed jobs, review requests, new reviews,
        average rating and response rate. The request rate tells you whether the
        process is happening; the themes tell you whether the customer
        experience is improving.
      </P>

      <H2>A 30-day review improvement plan</H2>
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
                Week
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Action
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Measure
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                "Week 1",
                "Check profile details, ownership, photos and direct review link.",
                "Link works and information is accurate.",
              ],
              [
                "Week 2",
                "Write the request template and train the team on the review-ready moment.",
                "Every eligible job has a clear owner.",
              ],
              [
                "Week 3",
                "Send the request after completed jobs and one polite reminder where needed.",
                "Requests sent compared with eligible jobs.",
              ],
              [
                "Week 4",
                "Read responses, reply to reviews and fix one recurring service issue.",
                "New reviews, themes and operational action.",
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

      <H2>The bottom line</H2>
      <P>
        More 5-star reviews come from a reliable customer experience and a
        reliable follow-up habit. Get your Google Business Profile right, ask at
        the right moment, send a direct link and invite an honest review without
        buying or manipulating the result. Respond to the reviews you earn and
        use their themes to improve the way the business runs.
      </P>
      <P>
        Solvr helps Australian tradies keep customer details, job status and
        follow-up actions organised, so asking for feedback does not depend on
        remembering it after a long day on the tools.{" "}
        <strong>
          Start your free trial and turn more completed jobs into proof that
          helps you win the next one.
        </strong>
      </P>
    </BlogPostPage>
  );
}
