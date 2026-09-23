/**
 * Durable ASP payload envelope.
 * Keeps source-system Peppol pass-through intact across submit/requeue,
 * while optionally recording the last ASP submission payload for audit.
 */

export type AspPayloadEnvelopeV2 = {
  version: 2;
  passthrough: Record<string, unknown>;
  lastSubmission?: {
    at: string;
    payload: unknown;
  };
};

export function wrapAspPassthrough(
  passthrough: Record<string, unknown>,
): string {
  const envelope: AspPayloadEnvelopeV2 = {
    version: 2,
    passthrough,
  };
  return JSON.stringify(envelope);
}

/**
 * Extract source pass-through from aspPayload.
 * Supports v2 envelope and legacy flat JSON. Returns null if the stored
 * value looks like an ASP submission result (json+xml) with no passthrough.
 */
export function parseAspPassthrough(
  raw: string | null | undefined,
): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (
      parsed &&
      parsed.version === 2 &&
      parsed.passthrough &&
      typeof parsed.passthrough === 'object'
    ) {
      return parsed.passthrough as Record<string, unknown>;
    }

    // Legacy overwrite shape from ClearTax adapter — no recoverable pass-through
    if (parsed?.json != null && parsed?.xml != null && !parsed.passthrough) {
      return null;
    }

    // Legacy flat pass-through written at create time
    return parsed;
  } catch {
    return null;
  }
}

/** Read Peppol XML from a stored ASP submission envelope, if present. */
export function extractStoredSubmissionXml(
  raw: string | null | undefined,
): string | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const submission = parsed?.lastSubmission as
      | { payload?: unknown }
      | undefined;
    const payload = submission?.payload;

    if (payload && typeof payload === 'object' && payload !== null) {
      const xml = (payload as Record<string, unknown>).xml;
      if (typeof xml === 'string' && xml.trim()) {
        return xml;
      }
    }

    if (typeof parsed.xml === 'string' && parsed.xml.trim()) {
      return parsed.xml;
    }

    return null;
  } catch {
    return null;
  }
}

/** Preserve passthrough and attach last ASP submission payload. */
export function mergeSubmissionIntoAspPayload(
  existingRaw: string | null | undefined,
  submissionPayload: unknown,
): string {
  const passthrough = parseAspPassthrough(existingRaw) ?? {};
  const envelope: AspPayloadEnvelopeV2 = {
    version: 2,
    passthrough,
    lastSubmission: {
      at: new Date().toISOString(),
      payload: submissionPayload,
    },
  };
  return JSON.stringify(envelope);
}
