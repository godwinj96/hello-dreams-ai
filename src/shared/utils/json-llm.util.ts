export interface JsonValidationResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Basic helper to build a strict JSON-only instruction for LLM calls.
 * Keep short to reduce prompt bloat; callers should prepend domain-specific schema text.
 */
export const buildJsonOnlyInstruction = (
  schemaDescription: string,
  example: object,
): string => {
  return [
    'Return ONLY a single JSON object. No prose, no explanations, no code fences, no markdown.',
    'The response must be valid JSON that can be parsed directly and stored.',
    'Follow this schema strictly:',
    schemaDescription.trim(),
    'Example JSON (structure, not content to copy):',
    JSON.stringify(example, null, 2),
  ].join('\n');
};

/**
 * Parses and validates that the payload is a JSON object (not an array/string).
 */
export const parseJsonObject = <T = any>(raw: string): JsonValidationResult<T> => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, data: parsed as T };
    }
    return { ok: false, error: 'Expected a JSON object at the top level.' };
  } catch (error) {
    return { ok: false, error: 'Invalid JSON returned from model.' };
  }
};



