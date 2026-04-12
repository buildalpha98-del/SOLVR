import { z } from "/home/ubuntu/ai-business-report/node_modules/zod/lib/index.mjs";

function test(name, schema, value) {
  const result = schema.safeParse(value);
  if (result.success) {
    console.log(`${name}: PASS (value: ${JSON.stringify(result.data)})`);
  } else {
    console.log(`${name}: FAIL — "${result.error.issues[0].message}" (code: ${result.error.issues[0].code})`);
  }
}

// Which validator produces "String doesn't match the expected pattern"?
test("url valid", z.string().url(), "https://g.page/r/abc123");
test("url invalid", z.string().url(), "not-a-url");
test("url empty", z.string().url(), "");
test("email valid", z.string().email(), "john@example.com");
test("email invalid", z.string().email(), "not-an-email");
test("email empty string", z.string().email(), "");
test("email nullish with null", z.string().email().nullish(), null);
test("email nullish with empty", z.string().email().nullish(), "");
test("email nullish with invalid", z.string().email().nullish(), "not-an-email");
test("regex postcode", z.string().regex(/^\d{4}$/), "2000");
test("regex postcode invalid", z.string().regex(/^\d{4}$/), "NSW 2000");
test("regex gst", z.string().regex(/^\d{1,3}(\.\d{1,2})?$/), "10.00");
test("regex gst invalid", z.string().regex(/^\d{1,3}(\.\d{1,2})?$/), "10%");

// The key test — what does z.string().url() return for a Google Maps review link?
const gmapsLink = "https://maps.google.com/maps?cid=1234567890";
const gmapsShort = "https://g.page/r/CabcdefghijkAE/review";
const gmapsNew = "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4";
test("gmaps link 1", z.string().url(), gmapsLink);
test("gmaps link 2", z.string().url(), gmapsShort);
test("gmaps link 3", z.string().url(), gmapsNew);

// What about the audioUrl in processVoiceRecording?
test("audioUrl S3", z.string().url(), "https://s3.amazonaws.com/bucket/audio.mp4");
test("audioUrl CDN", z.string().url(), "https://cdn.manus.im/audio/recording.mp4");

console.log("\n--- Checking which error message matches 'String doesn't match the expected pattern' ---");
// This is the exact error message from the bug report
const candidates = [
  ["url", z.string().url(), "not-a-url"],
  ["email", z.string().email(), "not@valid"],
  ["regex", z.string().regex(/^\d{4}$/), "abc"],
];
for (const [name, schema, val] of candidates) {
  const r = schema.safeParse(val);
  if (!r.success) {
    const msg = r.error.issues[0].message;
    const matches = msg.includes("match") || msg.includes("pattern");
    console.log(`${name}: "${msg}" ${matches ? "← MATCHES" : ""}`);
  }
}
