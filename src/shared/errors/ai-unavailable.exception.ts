import { ServiceUnavailableException } from '@nestjs/common';

/**
 * Why every configured AI provider refused the request.
 *
 * `quota_exhausted` is called out separately because it is an account/billing
 * problem the operator must fix — retrying will never clear it, and the UI
 * should say so rather than inviting the user to try again.
 */
export type AiFailureReason =
  | 'quota_exhausted'
  | 'not_configured'
  | 'provider_error';

export interface AiUnavailableDetails {
  reason: AiFailureReason;
  providersTried: string[];
}

const MESSAGES: Record<AiFailureReason, string> = {
  quota_exhausted:
    'The AI service is temporarily unavailable because the provider quota has been exhausted. Please contact support — retrying will not help.',
  not_configured:
    'No AI provider is configured. Please contact support so this can be enabled.',
  provider_error:
    'The AI service is temporarily unavailable. Please try again in a few minutes.',
};

/**
 * Thrown when the whole provider chain has been exhausted.
 *
 * Extends ServiceUnavailableException so the global filter emits a 503 with the
 * structured body intact — the frontend keys off `code` to render a real error
 * state instead of an indefinite loading skeleton.
 */
export class AiUnavailableException extends ServiceUnavailableException {
  constructor(details: AiUnavailableDetails) {
    super({
      statusCode: 503,
      error: 'Service Unavailable',
      code: 'AI_PROVIDER_UNAVAILABLE',
      reason: details.reason,
      providersTried: details.providersTried,
      message: MESSAGES[details.reason],
    });
  }
}

/** Recognises the provider responses that mean "out of credit", not "try again". */
export function isQuotaError(error: unknown): boolean {
  const err = error as
    | { status?: number; code?: string; type?: string; message?: string }
    | undefined;
  if (!err) return false;

  const code = String(err.code ?? '');
  const type = String(err.type ?? '');
  if (
    code === 'insufficient_quota' ||
    code === 'credit_balance_exhausted' ||
    type === 'insufficient_quota'
  ) {
    return true;
  }

  const message = String(err.message ?? '').toLowerCase();
  return (
    message.includes('insufficient_quota') ||
    message.includes('no credits remaining') ||
    message.includes('exceeded your current quota')
  );
}
