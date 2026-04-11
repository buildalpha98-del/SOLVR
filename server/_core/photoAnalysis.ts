import { invokeLLM } from "./llm";

export interface PhotoJobContext {
  jobTitle: string;
  jobDescription?: string | null;
  tradeType?: string | null;
  customerAddress?: string | null;
  lineItems?: { description: string; quantity: number; unit: string }[];
  tradieCaption?: string | null;
}

/**
 * Builds a rich, job-specific prompt for the vision model.
 * The more context provided, the more specific and useful the photo description will be.
 */
function buildPhotoAnalysisPrompt(ctx: PhotoJobContext): string {
  const lineItemsSummary =
    ctx.lineItems && ctx.lineItems.length > 0
      ? ctx.lineItems
          .slice(0, 8) // cap at 8 to keep prompt concise
          .map((li) => `• ${li.description} (${li.quantity} ${li.unit})`)
          .join("\n")
      : null;

  const tradeLabel = ctx.tradeType
    ? ctx.tradeType.charAt(0).toUpperCase() + ctx.tradeType.slice(1).replace(/_/g, " ")
    : "Trade";

  return `You are writing a professional site photo description for an Australian ${tradeLabel} quote/proposal document.

━━━ JOB CONTEXT ━━━
Job: ${ctx.jobTitle}
${ctx.jobDescription ? `Description: ${ctx.jobDescription}` : ""}
${ctx.customerAddress ? `Site Address: ${ctx.customerAddress}` : ""}
${lineItemsSummary ? `Quoted Line Items:\n${lineItemsSummary}` : ""}
${ctx.tradieCaption ? `Tradie's Caption: "${ctx.tradieCaption}"` : ""}

━━━ YOUR TASK ━━━
Write 2–4 professional sentences describing what is visible in this photo, specifically in relation to the job above.

REQUIREMENTS:
1. Be specific — reference the actual items visible (e.g. "The existing 25mm copper isolation valve" not just "a valve").
2. Use trade-appropriate terminology for a ${tradeLabel} job.
3. If the photo shows existing conditions (pre-work), describe them factually — note any visible wear, damage, corrosion, age, or non-compliance that is relevant to the quoted scope.
4. If the photo shows completed work, describe what was installed/completed and how it relates to the quoted line items.
5. If the site address is provided, you may reference it (e.g. "The existing hot water unit at [address]...").
6. Keep it factual and objective — this appears in a customer-facing document.
7. Do NOT speculate about things not visible in the photo.
8. Do NOT mention photo quality, angle, lighting, or composition.
9. Do NOT use vague language like "some pipes" or "a fixture" — be specific about what you can see.

EXAMPLE (plumbing job):
"The existing 25-year-old electric hot water unit at the rear of the property showing visible corrosion at the inlet valve and base plate. Sediment staining on the concrete slab beneath the unit indicates a slow leak at the pressure relief valve, consistent with the replacement scope quoted. The unit is positioned in a confined space requiring careful disconnection of the existing copper pipework."`;
}

/**
 * Generates a professional AI description for a single site photo using vision model.
 * Accepts either a simple string jobContext (legacy) or a rich PhotoJobContext object.
 */
export async function analyseQuotePhoto(
  imageUrl: string,
  jobContext: string | PhotoJobContext,
  tradieCaption?: string,
): Promise<string> {
  // Support legacy string-based jobContext for backwards compatibility
  const prompt =
    typeof jobContext === "string"
      ? buildPhotoAnalysisPrompt({ jobTitle: jobContext, tradieCaption })
      : buildPhotoAnalysisPrompt({ ...jobContext, tradieCaption: jobContext.tradieCaption ?? tradieCaption });

  const response = await invokeLLM({
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "image_url" as const, image_url: { url: imageUrl } },
          { type: "text" as const, text: prompt },
        ],
      },
    ],
  });

  const rawContent = response.choices[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent : null;
  if (!content) throw new Error("No content returned from vision model for photo analysis");
  return content;
}

/**
 * Analyses all photos in parallel. Returns array of descriptions in same order as input.
 * Accepts either a simple string jobContext (legacy) or a rich PhotoJobContext object.
 */
export async function analyseQuotePhotos(
  photos: { imageUrl: string; caption?: string | null }[],
  jobContext: string | PhotoJobContext,
): Promise<string[]> {
  return Promise.all(
    photos.map((p) =>
      analyseQuotePhoto(
        p.imageUrl,
        jobContext,
        p.caption ?? undefined,
      ),
    ),
  );
}
