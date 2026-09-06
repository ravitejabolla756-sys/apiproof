# Executable fixture patch semantics

`transformations.json` complements the existing Stripe advisory records without changing impact/planning rules. Each entry is bound to the SHA-256 digest of the corresponding `RegistryChangeSchema`-parsed record and declares an executable AST primitive, fields, constraints, citations and limitations.

Adding a replacement name to a Phase 3 record does not authorize patch syntax. A new patch rule needs explicit shape/value semantics, a supported AST primitive, positive and negative fixture labels, digest binding and review. Missing or stale semantics refuse generation. Runtime/customer validity is never inferred from these rules.
