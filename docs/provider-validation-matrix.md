# Provider Validation Matrix

This matrix distinguishes deterministic local registry coverage from real repository or deployed-worker validation. A passing local fixture is not evidence of a live provider scan.

| Provider | Reviewed rule surface | Local deterministic status | Live repository status |
| --- | --- | --- | --- |
| OpenAI | model retirement; Assistants resource sunset | PASS; exact `responses.create` worker fixture added | PENDING controlled staging scan |
| Anthropic | model retirement; parameter restrictions | PASS | NOT RUN |
| GitHub | organization response fields; synchronous SBOM endpoint | PASS | NOT RUN |
| Twilio | regional domains; Studio endpoint | PASS | NOT RUN |
| Supabase | `logs.all`; OpenAPI anon-key restriction | PASS | NOT RUN |
| Slack | `files.upload` operation retirement | PASS | NOT RUN |
| Shopify | Checkout resource shutdown | PASS | NOT RUN |
| LaunchDarkly | API version retirement | PASS; static/dynamic header coverage | NOT RUN |
| AWS | CloudWatch Evidently resource retirement | PASS | NOT RUN |
| Cloudflare | Service-key authentication removal | PASS | NOT RUN |
| ElevenLabs | exact model retirements | PASS | NOT RUN |
| Clerk | version/endpoint/field removals | PASS | NOT RUN |
| Groq | exact model decommissioning | PASS | NOT RUN |
| Firebase | Instance ID server API decommissioning | PASS | NOT RUN |
| Google Cloud | Cloud API Registry MCP capability shutdown | PASS | NOT RUN |

The local reviewed registry currently contains 20 reviewed rules across these 15 providers. The registry is official-source gated and synthetic fixtures remain outside the production registry.

## Limits

- Provider discovery does not prove breaking-change applicability.
- Dynamic, wrapper-mediated, token-bound, and unresolved evidence remains `NEEDS_REVIEW`.
- No SDK package/version or endpoint behavior is claimed unless encoded by the reviewed record.
- Live provider coverage is not complete until an authorized scan produces persisted evidence.
