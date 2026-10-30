import type { CandidateChange } from '@apiproof/shared';

/* eslint-disable max-lines -- immutable official-source candidate corpus; no executable logic lives here. */

/** Source-backed expansion candidates imported from the official provider review corpus. */
export const PROVIDER_EXPANSION_BATCH11_CANDIDATES = [
  {
    "candidateId": "aws-cloudwatch-evidently-end-of-support-2025-10-16",
    "providerId": "aws",
    "sourceUrl": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/DocumentHistory.html",
    "sourceType": "official-documentation",
    "sourceFingerprint": "d9f090a6fe00ffdceb96b5faf24d3f987b167f1bc629a8958bc50c2d39b6c9e9",
    "documentFingerprint": "d9f090a6fe00ffdceb96b5faf24d3f987b167f1bc629a8958bc50c2d39b6c9e9",
    "evidenceFingerprint": "3f83aa108bfe8fadff63add43c523a99b5b971d916e8510b4b4060ca49d4f64c",
    "sourceEvidence": {
      "providerId": "aws",
      "sourceUrl": "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/DocumentHistory.html",
      "sourceTitle": "Amazon CloudWatch document history",
      "sourceLocator": "section:End of support notice: Amazon CloudWatch Evidently",
      "claims": [
        {
          "key": "publishedAt",
          "value": "2024-10-17"
        },
        {
          "key": "removalAt",
          "value": "2025-10-16"
        },
        {
          "key": "resource",
          "value": "Amazon CloudWatch Evidently"
        },
        {
          "key": "status",
          "value": "AWS will discontinue support"
        },
        {
          "key": "effect",
          "value": "Evidently console and resources unavailable after end of support"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-08",
    "state": "needs_review",
    "payload": {
      "changeId": "aws-cloudwatch-evidently-end-of-support-2025-10-16",
      "title": "AWS CloudWatch Evidently end of support",
      "description": "AWS documents that support for Amazon CloudWatch Evidently ends on October 16, 2025 and that the Evidently console and resources will no longer be available after end of support. No replacement service is stated in the captured notice.",
      "changeType": "endpoint_removed",
      "publishedAt": "2024-10-17",
      "removalAt": "2025-10-16",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "resource"
        ]
      },
      "affectedResources": [
        "Amazon CloudWatch Evidently"
      ],
      "severity": "high",
      "sourceTitle": "Amazon CloudWatch document history",
      "sourceFacts": [
        "AWS documents that support for Amazon CloudWatch Evidently ends on October 16, 2025 and that the Evidently console and resources will no longer be available after end of support. No replacement service is stated in the captured notice."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-08",
        "actor": "official-source-capture",
        "note": "Captured AWS’s official CloudWatch document history end-of-support notice for Amazon CloudWatch Evidently."
      },
      {
        "state": "normalized",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "sendgrid-v2-mail-send-migration-to-v3",
    "providerId": "sendgrid",
    "sourceUrl": "https://www.twilio.com/docs/sendgrid/for-developers/sending-email/migrating-from-v2-to-v3-mail-send",
    "sourceType": "migration-guide",
    "sourceFingerprint": "2d57291e70b83b8fbabc9e87a10d5798f810210e2129e5d1e61b9b41b25a8e27",
    "documentFingerprint": "2d57291e70b83b8fbabc9e87a10d5798f810210e2129e5d1e61b9b41b25a8e27",
    "evidenceFingerprint": "f98938c8b9b158a29cb989bebd8831f8baa16d334a358d45304e5e3845665471",
    "sourceEvidence": {
      "providerId": "sendgrid",
      "sourceUrl": "https://www.twilio.com/docs/sendgrid/for-developers/sending-email/migrating-from-v2-to-v3-mail-send",
      "sourceTitle": "How To Migrate From v2 to v3 Mail Send",
      "sourceLocator": "section:Why should you migrate?",
      "claims": [
        {
          "key": "affectedApi",
          "value": "SendGrid Web API v2 Mail Send"
        },
        {
          "key": "affectedEndpoint",
          "value": "/api/mail.send.json"
        },
        {
          "key": "replacementEndpoint",
          "value": "/v3/mail/send"
        },
        {
          "key": "replacement",
          "value": "SendGrid Web API v3 Mail Send"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-15",
    "state": "needs_review",
    "payload": {
      "changeId": "sendgrid-v2-mail-send-migration-to-v3",
      "title": "SendGrid v2 Mail Send migration to v3",
      "description": "Twilio SendGrid documents migration from the Web API v2 Mail Send endpoint at /api/mail.send.json to the v3 Mail Send endpoint at /v3/mail/send. The candidate does not assert a shutdown date, SDK package behavior, or unrelated SendGrid v2 endpoints.",
      "changeType": "endpoint_removed",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "endpoint"
        ]
      },
      "affectedEndpoints": [
        "/api/mail.send.json"
      ],
      "replacement": {
        "endpoint": "/v3/mail/send"
      },
      "severity": "medium",
      "sourceTitle": "How To Migrate From v2 to v3 Mail Send",
      "sourceFacts": [
        "Twilio SendGrid documents migration from the Web API v2 Mail Send endpoint at /api/mail.send.json to the v3 Mail Send endpoint at /v3/mail/send. The candidate does not assert a shutdown date, SDK package behavior, or unrelated SendGrid v2 endpoints."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-15",
        "actor": "official-source-capture",
        "note": "Fetched the official Twilio SendGrid migration guide and retained only the documented v2 Mail Send endpoint and v3 replacement."
      },
      {
        "state": "normalized",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "shopify-checkout-api-shutdown-2025-04-01",
    "providerId": "shopify",
    "sourceUrl": "https://shopify.dev/changelog/posts/checkout-apis-will-be-shut-down-april-1-2025",
    "sourceType": "official-changelog",
    "sourceFingerprint": "1f9fd1ff6fef62f1aeb3f77937865de9fab30c9051697ca2f68606cf16512379",
    "documentFingerprint": "1f9fd1ff6fef62f1aeb3f77937865de9fab30c9051697ca2f68606cf16512379",
    "evidenceFingerprint": "a00b491e6be2deda68588c345fb28ceecfe5f3dfa612fcdc0428439529d4eb10",
    "sourceEvidence": {
      "providerId": "shopify",
      "sourceUrl": "https://shopify.dev/changelog/posts/checkout-apis-will-be-shut-down-april-1-2025",
      "sourceTitle": "Checkout APIs will be shut down April 1, 2025",
      "sourceLocator": "article:Checkout APIs will be shut down April 1, 2025",
      "claims": [
        {
          "key": "removalAt",
          "value": "2025-04-01"
        },
        {
          "key": "affectedResource",
          "value": "Storefront Checkout mutations"
        },
        {
          "key": "affectedResource",
          "value": "REST Checkout endpoints"
        },
        {
          "key": "replacementResource",
          "value": "Storefront Cart API"
        },
        {
          "key": "replacementResource",
          "value": "Checkout Sheet Kit"
        },
        {
          "key": "publishedAt",
          "value": "2025-03-02"
        },
        {
          "key": "scopeBoundary",
          "value": "Unrelated to the prior move from checkout.liquid to Checkout Extensibility"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-08",
    "state": "needs_review",
    "payload": {
      "changeId": "shopify-checkout-api-shutdown-2025-04-01",
      "title": "Shopify Checkout API shutdown",
      "description": "Shopify documents shutdown of deprecated Storefront Checkout mutations and REST Checkout endpoints and directs merchants to the Storefront Cart API or Checkout Sheet Kit.",
      "changeType": "endpoint_removed",
      "publishedAt": "2025-03-02",
      "removalAt": "2025-04-01",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "resource"
        ]
      },
      "affectedResources": [
        "Storefront Checkout mutations",
        "REST Checkout endpoints"
      ],
      "replacement": {
        "resources": [
          "Storefront Cart API",
          "Checkout Sheet Kit"
        ]
      },
      "severity": "high",
      "sourceTitle": "Checkout APIs will be shut down April 1, 2025",
      "sourceFacts": [
        "Shopify documents shutdown of deprecated Storefront Checkout mutations and REST Checkout endpoints and directs merchants to the Storefront Cart API or Checkout Sheet Kit."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-08",
        "actor": "official-source-capture",
        "note": "Captured the complete official Shopify Checkout API shutdown changelog article and its migration guidance."
      },
      {
        "state": "normalized",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "auth0-enabled-clients-field-deprecation-2026-07-13",
    "providerId": "auth0",
    "sourceUrl": "https://auth0.com/docs/troubleshoot/product-lifecycle/deprecations-and-migrations",
    "sourceType": "deprecation-notice",
    "sourceFingerprint": "3835836ae02c82d5e414d17ad86855f943f836aef5c1f16ef75256bfe4c9b1e3",
    "documentFingerprint": "3835836ae02c82d5e414d17ad86855f943f836aef5c1f16ef75256bfe4c9b1e3",
    "evidenceFingerprint": "b9e362a3528ba09b390ca0c069fc8631a8ec1538e4e82380cd319d544d44073a",
    "sourceEvidence": {
      "providerId": "auth0",
      "sourceUrl": "https://auth0.com/docs/troubleshoot/product-lifecycle/deprecations-and-migrations",
      "sourceTitle": "Deprecations and Migrations",
      "sourceLocator": "section:Legacy management of connection enabled clients",
      "claims": [
        {
          "key": "deprecatedAt",
          "value": "2026-01-13"
        },
        {
          "key": "removalAt",
          "value": "2026-07-13"
        },
        {
          "key": "endpoint",
          "value": "GET /api/v2/connections"
        },
        {
          "key": "endpoint",
          "value": "GET /api/v2/connections/{id}"
        },
        {
          "key": "endpoint",
          "value": "PATCH /api/v2/connections/{id}"
        },
        {
          "key": "responseField",
          "value": "enabled_clients"
        },
        {
          "key": "replacement",
          "value": "dedicated connection client endpoints"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-08",
    "state": "needs_review",
    "payload": {
      "changeId": "auth0-enabled-clients-field-deprecation-2026-07-13",
      "title": "Auth0 enabled_clients field deprecation",
      "description": "Auth0 documents deprecation of the enabled_clients field on the listed Management API connection operations and directs callers to dedicated enabled-client endpoints.",
      "changeType": "response_field_removed",
      "effectiveAt": "2026-07-13",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "endpoint",
          "response_field"
        ]
      },
      "affectedEndpoints": [
        "GET /api/v2/connections",
        "GET /api/v2/connections/{id}",
        "PATCH /api/v2/connections/{id}"
      ],
      "affectedResponseFields": [
        "enabled_clients"
      ],
      "replacement": {
        "endpoint": "dedicated connection client endpoints"
      },
      "severity": "high",
      "sourceTitle": "Deprecations and Migrations",
      "sourceFacts": [
        "Auth0 documents deprecation of the enabled_clients field on the listed Management API connection operations and directs callers to dedicated enabled-client endpoints."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-08",
        "actor": "official-source-capture",
        "note": "Re-fetched Auth0’s official deprecation page; the candidate-specific enabled_clients evidence is unchanged."
      },
      {
        "state": "normalized",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "auth0-legacy-enabled-clients-management-deprecation-2026-07-13",
    "providerId": "auth0",
    "sourceUrl": "https://auth0.com/docs/troubleshoot/product-lifecycle/deprecations-and-migrations",
    "sourceType": "deprecation-notice",
    "sourceFingerprint": "37b6d346d1c3aa7d5ebbe4499be5934cbc435480dac33373aa9049fd58277203",
    "documentFingerprint": "37b6d346d1c3aa7d5ebbe4499be5934cbc435480dac33373aa9049fd58277203",
    "evidenceFingerprint": "0266f5e11d918c3294bfb5c1a8cc1a2c1f86c6b7df34909058b92d663f6d5b93",
    "sourceEvidence": {
      "providerId": "auth0",
      "sourceUrl": "https://auth0.com/docs/troubleshoot/product-lifecycle/deprecations-and-migrations",
      "sourceTitle": "Deprecations and Migrations",
      "sourceLocator": "section:Legacy Management of Connection’s Enabled Clients",
      "claims": [
        {
          "key": "affectedEndpoints",
          "value": "GET /api/v2/connections; GET /api/v2/connections/{id}; PATCH /api/v2/connections/{id}"
        },
        {
          "key": "affectedField",
          "value": "enabled_clients"
        },
        {
          "key": "deprecatedAt",
          "value": "2026-01-13"
        },
        {
          "key": "endOfLife",
          "value": "2026-07-13"
        },
        {
          "key": "replacement",
          "value": "Get enabled clients for a connection; Update enabled clients for a connection"
        },
        {
          "key": "boundary",
          "value": "Auth0 Management API connection enabled_clients management only; no claim about other connection fields or authentication flows"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-16",
    "state": "needs_review",
    "payload": {
      "changeId": "auth0-legacy-enabled-clients-management-deprecation-2026-07-13",
      "title": "Auth0 legacy enabled_clients management deprecation",
      "description": "Auth0 documents the enabled_clients field as deprecated for the listed connection-management operations and directs callers to dedicated enabled-client endpoints. The candidate is bounded to that field and endpoint set without generalizing to other connection fields or authentication flows.",
      "changeType": "endpoint_removed",
      "effectiveAt": "2026-01-13",
      "removalAt": "2026-07-13",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "endpoint",
          "resource"
        ]
      },
      "affectedEndpoints": [
        "GET /api/v2/connections",
        "GET /api/v2/connections/{id}",
        "PATCH /api/v2/connections/{id}"
      ],
      "affectedResources": [
        "connection.enabled_clients management"
      ],
      "replacement": {
        "resources": [
          "Get enabled clients for a connection",
          "Update enabled clients for a connection"
        ]
      },
      "severity": "high",
      "sourceTitle": "Deprecations and Migrations",
      "sourceFacts": [
        "Auth0 documents the enabled_clients field as deprecated for the listed connection-management operations and directs callers to dedicated enabled-client endpoints. The candidate is bounded to that field and endpoint set without generalizing to other connection fields or authentication flows."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-16",
        "actor": "official-source-capture",
        "note": "Captured Auth0’s official deprecations page documenting legacy enabled_clients management and the dedicated connection endpoints that replace it."
      },
      {
        "state": "normalized",
        "at": "2026-10-16",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-16",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "vercel-legacy-integration-webhook-endpoints-removal-2021-08-20",
    "providerId": "vercel",
    "sourceUrl": "https://vercel.com/changelog/sunsetting-ui-hooks-and-legacy-webhooks",
    "sourceType": "official-changelog",
    "sourceFingerprint": "1311464e47144d9460deffb84a1020e6753516218dc42f92dc7c86c613852633",
    "documentFingerprint": "1311464e47144d9460deffb84a1020e6753516218dc42f92dc7c86c613852633",
    "evidenceFingerprint": "343c13eb5e1f4f9bc5ee170a6870ac6822274afeb3b6b19a0b613f5e4335fc5f",
    "sourceEvidence": {
      "providerId": "vercel",
      "sourceUrl": "https://vercel.com/changelog/sunsetting-ui-hooks-and-legacy-webhooks",
      "sourceTitle": "Sunsetting UI-Hooks and Legacy Webhooks",
      "sourceLocator": "article:2021-08-20",
      "claims": [
        {
          "key": "removalAt",
          "value": "2021-08-20"
        },
        {
          "key": "affectedEndpoint",
          "value": "/v1/integrations/configuration/:id/metadata"
        },
        {
          "key": "affectedEndpoint",
          "value": "/v1/integrations/webhooks"
        },
        {
          "key": "affectedEndpoint",
          "value": "/v1/integrations/webhooks/:id"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-08",
    "state": "needs_review",
    "payload": {
      "changeId": "vercel-legacy-integration-webhook-endpoints-removal-2021-08-20",
      "title": "Vercel legacy integration webhook endpoint removal",
      "description": "Vercel documents removal of UI Hooks and manual integration webhook endpoints, including integration configuration metadata and webhook endpoints.",
      "changeType": "endpoint_removed",
      "removalAt": "2021-08-20",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "endpoint"
        ]
      },
      "affectedEndpoints": [
        "/v1/integrations/configuration/:id/metadata",
        "/v1/integrations/webhooks",
        "/v1/integrations/webhooks/:id"
      ],
      "severity": "high",
      "sourceTitle": "Sunsetting UI-Hooks and Legacy Webhooks",
      "sourceFacts": [
        "Vercel documents removal of UI Hooks and manual integration webhook endpoints, including integration configuration metadata and webhook endpoints."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-08",
        "actor": "official-source-capture",
        "note": "Re-fetched Vercel’s official changelog; the candidate-specific legacy integration endpoint evidence is unchanged."
      },
      {
        "state": "normalized",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "cloudflare-workers-kv-legacy-routes-2026-10-15",
    "providerId": "cloudflare",
    "sourceUrl": "https://developers.cloudflare.com/changelog/post/2026-07-15-kv-legacy-namespace-routes-deprecation/",
    "sourceType": "deprecation-notice",
    "sourceFingerprint": "01e0a1778217b537b6432ec736b800c8d237b8bbc763e8f7f55c878e716a2627",
    "documentFingerprint": "01e0a1778217b537b6432ec736b800c8d237b8bbc763e8f7f55c878e716a2627",
    "evidenceFingerprint": "e4a63108042cd68926067e16e250aa310624381b1a605e6225c8e33961b9aa0e",
    "sourceEvidence": {
      "providerId": "cloudflare",
      "sourceUrl": "https://developers.cloudflare.com/changelog/post/2026-07-15-kv-legacy-namespace-routes-deprecation/",
      "sourceTitle": "Workers KV legacy namespace routes deprecation",
      "sourceLocator": "article:2026-07-15",
      "claims": [
        {
          "key": "publishedAt",
          "value": "2026-07-15"
        },
        {
          "key": "removalAt",
          "value": "2026-10-15"
        },
        {
          "key": "affectedEndpoint",
          "value": "/accounts/{account_id}/workers/namespaces/*"
        },
        {
          "key": "replacementEndpoint",
          "value": "/accounts/{account_id}/storage/kv/namespaces/*"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-08",
    "state": "needs_review",
    "payload": {
      "changeId": "cloudflare-workers-kv-legacy-routes-2026-10-15",
      "title": "Cloudflare Workers KV legacy namespace routes deprecation",
      "description": "Cloudflare documents retirement of legacy Workers KV namespace routes and directs callers to the storage/kv namespace routes.",
      "changeType": "endpoint_removed",
      "publishedAt": "2026-07-15",
      "removalAt": "2026-10-15",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "endpoint"
        ]
      },
      "affectedEndpoints": [
        "/accounts/{account_id}/workers/namespaces/*"
      ],
      "replacement": {
        "endpoint": "/accounts/{account_id}/storage/kv/namespaces/*"
      },
      "severity": "high",
      "sourceTitle": "Workers KV legacy namespace routes deprecation",
      "sourceFacts": [
        "Cloudflare documents retirement of legacy Workers KV namespace routes and directs callers to the storage/kv namespace routes."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-08",
        "actor": "official-source-capture",
        "note": "Re-fetched the official Cloudflare changelog; the candidate-specific Workers KV legacy route evidence is unchanged."
      },
      {
        "state": "normalized",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "cloudflare-workers-kv-legacy-namespace-routes-removed-2026-10-15",
    "providerId": "cloudflare",
    "sourceUrl": "https://developers.cloudflare.com/fundamentals/api/reference/deprecations/",
    "sourceType": "deprecation-notice",
    "sourceFingerprint": "f6f6c6d6a7b23cc3e6d078a8a7c20bbcb5d6299c2d1b94c7a7d0c5e4f8e8d4a1",
    "documentFingerprint": "f6f6c6d6a7b23cc3e6d078a8a7c20bbcb5d6299c2d1b94c7a7d0c5e4f8e8d4a1",
    "evidenceFingerprint": "58ea79d177ca29f5075b4b6196c92290f8c3da3e6cd0b0e4d88b4d6021698554",
    "sourceEvidence": {
      "providerId": "cloudflare",
      "sourceUrl": "https://developers.cloudflare.com/fundamentals/api/reference/deprecations/",
      "sourceTitle": "API deprecations",
      "sourceLocator": "section:Workers KV: Legacy Namespace Routes",
      "claims": [
        {
          "key": "deprecationDate",
          "value": "2026-07-15"
        },
        {
          "key": "removalAt",
          "value": "2026-10-15"
        },
        {
          "key": "deprecatedRoutePrefix",
          "value": "/accounts/{account_id}/workers/namespaces/"
        },
        {
          "key": "replacementRoutePrefix",
          "value": "/accounts/{account_id}/storage/kv/namespaces/"
        },
        {
          "key": "scope",
          "value": "Workers KV namespace and key-management routes"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-15",
    "state": "needs_review",
    "payload": {
      "changeId": "cloudflare-workers-kv-legacy-namespace-routes-removed-2026-10-15",
      "title": "Cloudflare Workers KV legacy namespace route removal",
      "description": "Cloudflare documents that the legacy Workers KV namespace route family is deprecated and no longer supported after October 15, 2026. The documented replacement changes the route prefix from /workers/namespaces/ to /storage/kv/namespaces/. This candidate is limited to the listed route family and does not assert SDK or Terraform applicability.",
      "changeType": "endpoint_removed",
      "removalAt": "2026-10-15",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "endpoint"
        ]
      },
      "affectedEndpoints": [
        "GET /accounts/{account_id}/workers/namespaces/{namespace_id}/keys"
      ],
      "replacement": {
        "endpoint": "GET /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/keys"
      },
      "severity": "high",
      "sourceTitle": "API deprecations",
      "sourceFacts": [
        "Cloudflare documents that the legacy Workers KV namespace route family is deprecated and no longer supported after October 15, 2026. The documented replacement changes the route prefix from /workers/namespaces/ to /storage/kv/namespaces/. This candidate is limited to the listed route family and does not assert SDK or Terraform applicability."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-15",
        "actor": "official-source-capture",
        "note": "Captured Cloudflare’s official API deprecations notice for the legacy Workers KV namespace route family and its storage/kv replacement."
      },
      {
        "state": "normalized",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "cloudflare-account-roles-api-deprecated-2026-07-21",
    "providerId": "cloudflare",
    "sourceUrl": "https://developers.cloudflare.com/changelog/post/2026-07-21-account-role-api-deprecated/",
    "sourceType": "official-changelog",
    "sourceFingerprint": "0a21764112e8c82c2cafacca7b3d7446d3c2d4efd0edb11989ce920b92492770",
    "documentFingerprint": "0a21764112e8c82c2cafacca7b3d7446d3c2d4efd0edb11989ce920b92492770",
    "evidenceFingerprint": "927e8607225130b0cdd6e42a7c7649cdf45822edf5f5815338e38913b184d929",
    "sourceEvidence": {
      "providerId": "cloudflare",
      "sourceUrl": "https://developers.cloudflare.com/changelog/post/2026-07-21-account-role-api-deprecated/",
      "sourceTitle": "Account Role API deprecated",
      "sourceLocator": "article:2026-07-21",
      "claims": [
        {
          "key": "affectedApi",
          "value": "Account Roles API"
        },
        {
          "key": "affectedEndpoints",
          "value": "GET /accounts/{account_id}/roles; GET /accounts/{account_id}/roles/{role_id}"
        },
        {
          "key": "replacement",
          "value": "Permission Groups API"
        },
        {
          "key": "removalAt",
          "value": "not established in the source"
        },
        {
          "key": "boundary",
          "value": "Cloudflare account-role endpoints only; no claim about SDKs, unrelated IAM APIs, or a removal date"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-15",
    "state": "needs_review",
    "payload": {
      "changeId": "cloudflare-account-roles-api-deprecated-2026-07-21",
      "title": "Cloudflare Account Roles API deprecation",
      "description": "Cloudflare documents that the Account Roles API is deprecated in favor of the Permission Groups API. This candidate is limited to the documented account-role endpoint family and does not assert a removal date, SDK behavior, or unrelated IAM API changes.",
      "changeType": "endpoint_removed",
      "publishedAt": "2026-07-21",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "endpoint"
        ]
      },
      "affectedEndpoints": [
        "GET /accounts/{account_id}/roles",
        "GET /accounts/{account_id}/roles/{role_id}"
      ],
      "replacement": {
        "endpoint": "Permission Groups API"
      },
      "severity": "medium",
      "sourceTitle": "Account Role API deprecated",
      "sourceFacts": [
        "Cloudflare documents that the Account Roles API is deprecated in favor of the Permission Groups API. This candidate is limited to the documented account-role endpoint family and does not assert a removal date, SDK behavior, or unrelated IAM API changes."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-15",
        "actor": "official-source-capture",
        "note": "Captured Cloudflare’s official Account Role API deprecation notice and bounded the candidate to the documented account-role endpoint family and Permission Groups replacement."
      },
      {
        "state": "normalized",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "cloudflare-foundation-dns-field-removal-2026-11-23",
    "providerId": "cloudflare",
    "sourceUrl": "https://developers.cloudflare.com/fundamentals/api/reference/deprecations/",
    "sourceType": "deprecation-notice",
    "sourceFingerprint": "ca371eae19096771e2264ff0466cf6ff5d3181738464b8bf46d066f90d909a7d",
    "documentFingerprint": "ca371eae19096771e2264ff0466cf6ff5d3181738464b8bf46d066f90d909a7d",
    "evidenceFingerprint": "2310737b0cad3406bbdd9a64c3fcdcdcc1188738a1e03e7a0944dc203380e066",
    "sourceEvidence": {
      "providerId": "cloudflare",
      "sourceUrl": "https://developers.cloudflare.com/fundamentals/api/reference/deprecations/",
      "sourceTitle": "API deprecations",
      "sourceLocator": "section:Foundation DNS boolean setting",
      "claims": [
        {
          "key": "affectedField",
          "value": "foundation_dns"
        },
        {
          "key": "affectedEndpoints",
          "value": "/zones/{zone_id}/dns_settings; /accounts/{account_id}/dns_settings"
        },
        {
          "key": "removalAt",
          "value": "2026-11-23"
        },
        {
          "key": "replacement",
          "value": "nameservers.type: cloudflare.advanced"
        },
        {
          "key": "boundary",
          "value": "Cloudflare DNS settings foundation_dns field only; no claim about subscription state, zone migration, SDK behavior, or unrelated DNS fields"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-15",
    "state": "needs_review",
    "payload": {
      "changeId": "cloudflare-foundation-dns-field-removal-2026-11-23",
      "title": "Cloudflare foundation_dns field removal",
      "description": "Cloudflare documents that the foundation_dns boolean will no longer be returned or accepted by the DNS settings API beginning November 23, 2026, and directs clients to nameservers.type: cloudflare.advanced. This candidate is bounded to the named field and endpoint family and does not assert subscription or zone-migration behavior.",
      "changeType": "response_field_removed",
      "removalAt": "2026-11-23",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "endpoint",
          "response_field"
        ]
      },
      "affectedEndpoints": [
        "/zones/{zone_id}/dns_settings",
        "/accounts/{account_id}/dns_settings"
      ],
      "affectedResponseFields": [
        "foundation_dns"
      ],
      "replacement": {
        "resources": [
          "nameservers.type: cloudflare.advanced"
        ]
      },
      "severity": "high",
      "sourceTitle": "API deprecations",
      "sourceFacts": [
        "Cloudflare documents that the foundation_dns boolean will no longer be returned or accepted by the DNS settings API beginning November 23, 2026, and directs clients to nameservers.type: cloudflare.advanced. This candidate is bounded to the named field and endpoint family and does not assert subscription or zone-migration behavior."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-15",
        "actor": "official-source-capture",
        "note": "Captured Cloudflare’s official API deprecations reference and bounded the candidate to the foundation_dns field on the documented DNS settings endpoint family."
      },
      {
        "state": "normalized",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "cloudflare-dns-record-type-update-removal-2026-06-30",
    "providerId": "cloudflare",
    "sourceUrl": "https://developers.cloudflare.com/fundamentals/api/reference/deprecations/",
    "sourceType": "deprecation-notice",
    "sourceFingerprint": "ca371eae19096771e2264ff0466cf6ff5d3181738464b8bf46d066f90d909a7d",
    "documentFingerprint": "ca371eae19096771e2264ff0466cf6ff5d3181738464b8bf46d066f90d909a7d",
    "evidenceFingerprint": "2d818cb4263fb9f1f951547f18f142eb9bd6c90af639906d97242a8a0a34aca0",
    "sourceEvidence": {
      "providerId": "cloudflare",
      "sourceUrl": "https://developers.cloudflare.com/fundamentals/api/reference/deprecations/",
      "sourceTitle": "API deprecations",
      "sourceLocator": "section:DNS Record Type Updates via API",
      "claims": [
        {
          "key": "affectedBehavior",
          "value": "changing the type of an existing DNS record via the API"
        },
        {
          "key": "removalAt",
          "value": "2026-06-30"
        },
        {
          "key": "status",
          "value": "in-place record type changes no longer supported after June 30, 2026"
        },
        {
          "key": "replacement",
          "value": "delete and create a new DNS record; batch API may combine both operations"
        },
        {
          "key": "boundary",
          "value": "Cloudflare DNS record type updates only; no claim about ordinary attribute updates, SDK behavior, or unrelated DNS APIs"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-15",
    "state": "needs_review",
    "payload": {
      "changeId": "cloudflare-dns-record-type-update-removal-2026-06-30",
      "title": "Cloudflare DNS record type update removal",
      "description": "Cloudflare documents that changing the type of an existing DNS record through the API is no longer supported after June 30, 2026. Integrations should delete and create the record instead, optionally using the batch endpoint. This candidate is bounded to in-place record type changes and does not generalize to ordinary DNS attribute updates or SDK behavior.",
      "changeType": "endpoint_removed",
      "removalAt": "2026-06-30",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "resource"
        ]
      },
      "affectedResources": [
        "in-place DNS record type updates"
      ],
      "replacement": {
        "resources": [
          "delete and create DNS record",
          "DNS records batch API"
        ]
      },
      "severity": "high",
      "sourceTitle": "API deprecations",
      "sourceFacts": [
        "Cloudflare documents that changing the type of an existing DNS record through the API is no longer supported after June 30, 2026. Integrations should delete and create the record instead, optionally using the batch endpoint. This candidate is bounded to in-place record type changes and does not generalize to ordinary DNS attribute updates or SDK behavior."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-15",
        "actor": "official-source-capture",
        "note": "Captured Cloudflare’s official API deprecations reference and bounded the candidate to in-place DNS record type changes and the documented delete/create replacement workflow."
      },
      {
        "state": "normalized",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "cloudflare-zone-settings-batch-api-eol-2027-03-31",
    "providerId": "cloudflare",
    "sourceUrl": "https://developers.cloudflare.com/fundamentals/api/reference/deprecations/",
    "sourceType": "deprecation-notice",
    "sourceFingerprint": "ca371eae19096771e2264ff0466cf6ff5d3181738464b8bf46d066f90d909a7d",
    "documentFingerprint": "ca371eae19096771e2264ff0466cf6ff5d3181738464b8bf46d066f90d909a7d",
    "evidenceFingerprint": "a006ed0a892f84d3d24e01d6cb48a50d064aa0948d1518ac4abaf7bda163dccf",
    "sourceEvidence": {
      "providerId": "cloudflare",
      "sourceUrl": "https://developers.cloudflare.com/fundamentals/api/reference/deprecations/",
      "sourceTitle": "API deprecations",
      "sourceLocator": "section:Zone Settings Batch API",
      "claims": [
        {
          "key": "affectedEndpoints",
          "value": "GET /zones/{zone_id}/settings; PATCH /zones/{zone_id}/settings"
        },
        {
          "key": "endOfLifeAt",
          "value": "2027-03-31"
        },
        {
          "key": "status",
          "value": "Zone Settings Batch API endpoints deprecated and no longer available after March 31, 2027"
        },
        {
          "key": "replacement",
          "value": "per-setting GET/PATCH endpoints under /zones/{zone_id}/settings/{setting_id}"
        },
        {
          "key": "boundary",
          "value": "Cloudflare Zone Settings Batch API endpoints only; no claim about individual setting endpoints, SDK behavior, or unrelated Cloudflare APIs"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-15",
    "state": "needs_review",
    "payload": {
      "changeId": "cloudflare-zone-settings-batch-api-eol-2027-03-31",
      "title": "Cloudflare Zone Settings Batch API end of life",
      "description": "Cloudflare documents that the Zone Settings Batch API GET and PATCH endpoints are deprecated and reach end of life on March 31, 2027. Integrations should use the per-setting endpoints to read and edit individual settings. This candidate is bounded to the two batch endpoints and does not generalize to individual setting endpoints or SDK behavior.",
      "changeType": "endpoint_removed",
      "removalAt": "2027-03-31",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "endpoint"
        ]
      },
      "affectedEndpoints": [
        "GET /zones/{zone_id}/settings",
        "PATCH /zones/{zone_id}/settings"
      ],
      "replacement": {
        "resources": [
          "GET /zones/{zone_id}/settings/{setting_id}",
          "PATCH /zones/{zone_id}/settings/{setting_id}"
        ]
      },
      "severity": "high",
      "sourceTitle": "API deprecations",
      "sourceFacts": [
        "Cloudflare documents that the Zone Settings Batch API GET and PATCH endpoints are deprecated and reach end of life on March 31, 2027. Integrations should use the per-setting endpoints to read and edit individual settings. This candidate is bounded to the two batch endpoints and does not generalize to individual setting endpoints or SDK behavior."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-15",
        "actor": "official-source-capture",
        "note": "Captured Cloudflare’s official API deprecations reference and bounded the candidate to the deprecated Zone Settings Batch API read/edit endpoints and their per-setting replacements."
      },
      {
        "state": "normalized",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-15",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "launchdarkly-api-version-20220603-eol-2025-04-15",
    "providerId": "launchdarkly",
    "sourceUrl": "https://launchdarkly.com/docs/api/",
    "sourceType": "official-documentation",
    "sourceFingerprint": "e7fc7da9aee943cb863b3f7dd995d452f8862a1373f0af3967cd3b3f23e55fda",
    "documentFingerprint": "e7fc7da9aee943cb863b3f7dd995d452f8862a1373f0af3967cd3b3f23e55fda",
    "evidenceFingerprint": "ef593fa2ae35eac21cabdc1e418361b7cfd7ba58c33f705399d885554346257d",
    "sourceEvidence": {
      "providerId": "launchdarkly",
      "sourceUrl": "https://launchdarkly.com/docs/api/",
      "sourceTitle": "REST API overview",
      "sourceLocator": "section:API version changelog",
      "claims": [
        {
          "key": "removalAt",
          "value": "2025-04-15"
        },
        {
          "key": "affectedApiVersion",
          "value": "20220603"
        },
        {
          "key": "replacementApiVersion",
          "value": "20240415"
        },
        {
          "key": "status",
          "value": "EOL"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-08",
    "state": "needs_review",
    "payload": {
      "changeId": "launchdarkly-api-version-20220603-eol-2025-04-15",
      "title": "LaunchDarkly API version 20220603 EOL",
      "description": "LaunchDarkly’s API version table marks version 20220603 EOL on April 15, 2025 and identifies 20240415 as the current API version.",
      "changeType": "api_version_retired",
      "removalAt": "2025-04-15",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "api_version"
        ]
      },
      "apiVersionMetadata": {
        "version": "20220603",
        "replacement": "20240415"
      },
      "severity": "high",
      "sourceTitle": "REST API overview",
      "sourceFacts": [
        "LaunchDarkly’s API version table marks version 20220603 EOL on April 15, 2025 and identifies 20240415 as the current API version."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-08",
        "actor": "official-source-capture",
        "note": "Captured LaunchDarkly’s official API version table identifying 20220603 EOL on April 15, 2025 and 20240415 as the current replacement version."
      },
      {
        "state": "normalized",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-08",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  },
  {
    "candidateId": "braintree-transparent-redirect-deprecation",
    "providerId": "braintree",
    "sourceUrl": "https://developer.paypal.com/braintree/docs/reference/general/upgrade",
    "sourceType": "deprecation-notice",
    "sourceFingerprint": "75e925517dea20ea09f6a16b612ddf485c20ca7ad43aef4229a084269a75e87a",
    "documentFingerprint": "75e925517dea20ea09f6a16b612ddf485c20ca7ad43aef4229a084269a75e87a",
    "evidenceFingerprint": "153e87d81507aa592a17d40a580774f955b50e32ab90fea5962fd50e8581fd74",
    "sourceEvidence": {
      "providerId": "braintree",
      "sourceUrl": "https://developer.paypal.com/braintree/docs/reference/general/upgrade",
      "sourceTitle": "Upgrade to Braintree SDKs",
      "sourceLocator": "section:Transparent Redirect",
      "claims": [
        {
          "key": "affectedIntegration",
          "value": "Transparent Redirect"
        },
        {
          "key": "replacement",
          "value": "Braintree.js Drop-in integration"
        },
        {
          "key": "status",
          "value": "legacy integration upgrade path"
        }
      ]
    },
    "sourceFingerprintBasis": "full-body",
    "discoveredAt": "2026-10-13",
    "state": "needs_review",
    "payload": {
      "changeId": "braintree-transparent-redirect-deprecation",
      "title": "Braintree Transparent Redirect legacy integration",
      "description": "Braintree’s official upgrade guide identifies Transparent Redirect as a legacy integration and directs applications to Braintree.js or Drop-in UI. No SDK package version or removal date is asserted.",
      "changeType": "endpoint_removed",
      "applicabilityScope": {
        "dimensions": [
          "provider",
          "resource"
        ]
      },
      "affectedResources": [
        "Transparent Redirect"
      ],
      "replacement": {
        "resources": [
          "Braintree.js",
          "Drop-in UI"
        ]
      },
      "severity": "medium",
      "sourceTitle": "Upgrade to Braintree SDKs",
      "sourceFacts": [
        "Braintree’s official upgrade guide identifies Transparent Redirect as a legacy integration and directs applications to Braintree.js or Drop-in UI. No SDK package version or removal date is asserted."
      ],
      "unknowns": [
        "SDK package, SDK version, and SDK method applicability are not established by the captured source.",
        "Runtime wrappers and dynamically constructed requests are not inferred."
      ],
      "severityBasis": "Proposed severity reflects only the documented deprecation or removal; human review is required."
    },
    "auditTrail": [
      {
        "state": "discovered",
        "at": "2026-10-13",
        "actor": "official-source-capture",
        "note": "Fetched Braintree’s official upgrade guide and retained the documented Transparent Redirect replacement without asserting a removal date or SDK version."
      },
      {
        "state": "normalized",
        "at": "2026-10-13",
        "actor": "candidate-normalizer",
        "note": "Normalized only deterministic facts from the official source."
      },
      {
        "state": "needs_review",
        "at": "2026-10-13",
        "actor": "candidate-normalizer",
        "note": "Human review is required before promotion or compatibility claims."
      }
    ]
  }
] as const satisfies readonly CandidateChange[];

