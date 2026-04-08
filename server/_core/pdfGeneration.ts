import { renderToBuffer, Document } from "@react-pdf/renderer";
import React from "react";
import { QuoteProposalDocument, type QuoteProposalPdfInput } from "./QuoteProposalDocument";

/**
 * Generates a PDF buffer for a quote proposal.
 * Fetches logo and photo images as buffers before rendering.
 */
export async function generateQuotePdf(input: QuoteProposalPdfInput): Promise<Buffer> {
  // QuoteProposalDocument renders a <Document> internally
  // We need to cast to satisfy renderToBuffer's type
  const element = React.createElement(QuoteProposalDocument, { input }) as unknown as React.ReactElement<React.ComponentProps<typeof Document>>;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}

/**
 * Fetches a remote image URL and returns it as a Buffer.
 * Returns null if the fetch fails (so PDF renders without the image rather than crashing).
 */
export async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}
