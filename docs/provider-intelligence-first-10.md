# MY OWL — First 10 Reviewed Compatibility Rules

Generated from the local reviewed compatibility registry. No automatic migrations are claimed.

| Provider | Change | Shape | Severity | Migration | Verification |
| --- | --- | --- | --- | --- | --- |
| OpenAI | `openai-assistants-api-sunset-2026-08-26` | provider + resource | high | none | compatibility proof |
| OpenAI | `openai-gpt-4-5-preview-removal-2025-07-14` | provider + model | high | none | compatibility proof |
| Anthropic | `anthropic-claude-opus-4-1-retirement-2026-08-05` | provider + model | high | none | compatibility proof |
| Anthropic | `anthropic-opus-4-7-parameter-restrictions` | provider + model + parameter | high | none | compatibility proof |
| GitHub | `github-organization-security-fields-removed-2026-04-21` | provider + resource + response_field | medium | none | compatibility proof |
| GitHub | `github-synchronous-sbom-endpoint-removal-2026-11-13` | provider + endpoint | high | none | compatibility proof |
| Twilio | `twilio-regional-api-domain-removal-2026-04-28` | provider + domain | high | none | compatibility proof |
| Twilio | `twilio-studio-engagements-endpoint-deprecated` | provider + endpoint | high | none | compatibility proof |
| Supabase | `supabase-management-logs-all-removal-2026-09-23` | provider + endpoint | high | none | compatibility proof |
| Supabase | `supabase-openapi-anon-key-access-2026-03-11` | provider + endpoint + auth_or_header | high | none | compatibility proof |

## Proven compatibility shapes

- Model retirement
- Resource retirement
- Parameter/value restriction
- Response-field removal
- Endpoint removal
- Domain retirement
- Auth/credential restriction

This report records reviewed compatibility evidence only. It does not imply automatic patching, migration generation, or verification beyond the compatibility-proof layer.
