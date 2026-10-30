# Executable fixture patch semantics

`transformations.json` complements the existing reviewed change records without changing impact/planning rules. Current executable coverage includes bounded Stripe, Twilio, Shopify, SendGrid, OpenAI, Firebase, GitHub, Clerk, Supabase, Cloudflare, LaunchDarkly, ElevenLabs, and Groq transformations. Each entry is bound to the SHA-256 digest of the corresponding `RegistryChangeSchema`-parsed record and declares an executable AST primitive, fields, constraints, citations and limitations.

The Twilio namespace migration uses the `qualified-member-rename` primitive. It is intentionally limited to direct TypeScript call expressions with the exact `twilio.Twiml.<builder>` receiver; aliases, non-call references and dynamic expressions remain human-review-only. Shopify is limited to direct static `apiVersion: '2025-10'` properties, and SendGrid is limited to direct static `/api/mail.send.json` endpoint literals; version selection, payload/response behavior, and dynamic construction remain human-review-only.

Adding a replacement name to a Phase 3 record does not authorize patch syntax. A new patch rule needs explicit shape/value semantics, a supported AST primitive, positive and negative fixture labels, digest binding and review. Missing or stale semantics refuse generation. Runtime/customer validity is never inferred from these rules.
