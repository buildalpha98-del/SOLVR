import { invokeLLM } from "./llm";

const PHOTO_ANALYSIS_PROMPT = (jobContext: string, tradieCaption?: string) =>
  `You are writing photo descriptions for a professional trade quote/proposal document in Australia.

Job context: ${jobContext}
Tradie's caption (if provided): ${tradieCaption ?? "None"}

Describe what is visible in this photo in 1-3 professional sentences. Focus on:
- What the photo shows in relation to the job
- Use trade-appropriate terminology
- Keep it factual and objective — this appears in a customer-facing document
- Do NOT speculate about things not visible
- Do NOT mention photo quality or angle

Example: "The existing 25-year-old electric hot water unit showing visible corrosion at the inlet valve and base. Sediment staining on the concrete slab indicates a slow leak at the pressure relief valve."`;

/**
 * Generates a professional AI description for a single site photo using GPT-4o vision.
 */
export async function analyseQuotePhoto(
  imageUrl: string,
  jobContext: string,
  tradieCaption?: string,
): Promise<string> {
  const response = await invokeLLM({
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "image_url" as const, image_url: { url: imageUrl } },
          { type: "text" as const, text: PHOTO_ANALYSIS_PROMPT(jobContext, tradieCaption) },
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
 */
export async function analyseQuotePhotos(
  photos: { imageUrl: string; caption?: string | null }[],
  jobContext: string,
): Promise<string[]> {
  return Promise.all(
    photos.map((p) => analyseQuotePhoto(p.imageUrl, jobContext, p.caption ?? undefined)),
  );
}
