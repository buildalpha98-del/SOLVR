/**
 * Data API helper — DEAD STUB post-Manus migration.
 *
 * Previously a generic proxy over Manus Forge's WebDevService/CallApi, used to
 * hit third-party APIs (YouTube, etc.) through Manus's credential vault. That
 * proxy no longer exists and no caller in the server currently imports this
 * module.
 *
 * Kept as a throwing stub so any rediscovered caller fails loudly with a clear
 * message instead of 500-ing on a dead URL. If we genuinely need this again,
 * wire it to the upstream provider directly.
 */

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

export async function callDataApi(
  _apiId: string,
  _options: DataApiCallOptions = {}
): Promise<unknown> {
  throw new Error(
    "Data API proxy is not configured. The Manus Forge WebDevService/CallApi endpoint was removed during the Railway migration — call the upstream third-party API directly instead."
  );
}
