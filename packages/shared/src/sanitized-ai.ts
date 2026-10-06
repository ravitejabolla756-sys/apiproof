import { z } from 'zod';

/** Optional future-AI input. It is advisory context, never compatibility authority. */
export const SanitizedAiEvidenceSchema = z.strictObject({
  provider: z.string().min(1).max(64),
  changeId: z.string().min(1).max(128),
  operation: z.string().max(300).optional(),
  model: z.string().max(200).optional(),
  parameter: z.string().max(200).optional(),
  responseField: z.string().max(300).optional(),
  endpointClass: z.string().max(200).optional(),
  reasonCodes: z.array(z.string().max(100)).max(30),
  compatibilityStatus: z.enum(['AFFECTED', 'NOT_AFFECTED', 'NEEDS_REVIEW']),
}).superRefine((value, context) => {
  const serialized = JSON.stringify(value);
  if (/source|content|secret|token|api[_-]?key|password|credential|blob/i.test(serialized)) {
    context.addIssue({ code: 'custom', message: 'Sanitized AI evidence must not contain source, secret, or credential material.' });
  }
});
export type SanitizedAiEvidence = z.infer<typeof SanitizedAiEvidenceSchema>;

export function validateSanitizedAiEvidence(input: unknown): SanitizedAiEvidence {
  return SanitizedAiEvidenceSchema.parse(input);
}
