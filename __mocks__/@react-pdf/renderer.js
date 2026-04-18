// Manual mock for @react-pdf/renderer
// Used by vitest to avoid hanging on real PDF rendering in tests
// Plain async function — no vi.fn() needed here; tests spy via vi.mock() factory
const renderToBuffer = async () => Buffer.from("MOCK_PDF_BYTES");

module.exports = {
  renderToBuffer,
  Document: "Document",
  Page: "Page",
  View: "View",
  Text: "Text",
  Image: "Image",
  StyleSheet: { create: (s) => s },
  Font: { register: () => {} },
};
