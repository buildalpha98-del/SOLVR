/**
 * Call AI analysis pipeline. Real implementation lands in Chunk 5 (Task 5.1):
 *   transcript via Whisper → GPT-4o intent classifier → write back to callLogs +
 *   trigger regular APNs notification + SSE broadcast.
 *
 * For Chunk 4, this is a stub so /recording's structure is correct.
 */
export async function analyseCallTranscript(callLogId: number): Promise<void> {
  console.log("[CallIntelligence] AI analysis placeholder for callLogId", callLogId);
}
