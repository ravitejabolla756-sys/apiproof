export interface ProviderIntegration {
  id: string;
  name: string;
  category: string;
  status: 'reviewed' | 'detected';
  rulesCount: number;
  usagesCount?: number;
  iconName: string;
}

export interface ApiUsage {
  id: string;
  file: string;
  line?: number;
  symbol: string;
  codeSnippet: string;
  context?: string;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  repositoryId: string;
  defaultBranch: string;
  status: 'healthy' | 'affected' | 'migration_ready' | 'pr_created';
  statusLabel: string;
  lastScanAt: string;
  totalFiles: number;
  providers: string[];
  findingsCount: number;
  primarySdk?: string;
  twilioUsagesCount?: number;
}

export interface Finding {
  id: string;
  changeId: string;
  provider: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  repositoryName: string;
  affectedFile: string;
  symbol: string;
  status: 'open' | 'migration_verified' | 'pr_created' | 'resolved';
  oldCode: string;
  newCode: string;
  affectedVersions: string;
  targetVersion: string;
  sourceUrl: string;
  prNumber?: number;
  prUrl?: string;
}

export interface VerificationCheck {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  detail: string;
}

export interface PullRequestSummary {
  number: number;
  title: string;
  repository: string;
  owner: string;
  headBranch: string;
  baseBranch: string;
  state: 'draft' | 'open' | 'merged' | 'closed';
  url: string;
  author: string;
  humanReviewRequired: boolean;
  autoMergeEnabled: boolean;
  patchDigest: string;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: 'scan_completed' | 'finding_detected' | 'migration_verified' | 'pr_created' | 'inventory_indexed';
  title: string;
  description: string;
  repository: string;
  badge: string;
}

export interface OverviewStats {
  connectedRepositories: number;
  detectedIntegrationsCount: number;
  reviewedChangesChecked: number;
  openFindingsCount: number;
  verifiedMigrationsCount: number;
  draftPrsCount: number;
}

export const DEMO_STATS: OverviewStats = {
  connectedRepositories: 2,
  detectedIntegrationsCount: 9,
  reviewedChangesChecked: 11,
  openFindingsCount: 1,
  verifiedMigrationsCount: 1,
  draftPrsCount: 1,
};

export const DEMO_REPOSITORIES: Repository[] = [
  {
    id: 'bavio-ai-v1',
    name: 'Bavio-Ai-v1',
    owner: 'ravitejabolla756-sys',
    repositoryId: '1260141355',
    defaultBranch: 'main',
    status: 'healthy',
    statusLabel: 'Healthy / Not Affected',
    lastScanAt: '2026-09-11 00:54 UTC',
    totalFiles: 390,
    providers: ['Twilio', 'OpenAI', 'Supabase', 'Groq', 'Dodo Payments', 'Deepgram', 'ElevenLabs', 'Sarvam', 'Redis'],
    findingsCount: 0,
    primarySdk: 'twilio@^5.12.2',
    twilioUsagesCount: 27,
  },
  {
    id: 'apiproof-github-fixture',
    name: 'apiproof-github-fixture',
    owner: 'ravitejabolla756-sys',
    repositoryId: '1363070568',
    defaultBranch: 'main',
    status: 'pr_created',
    statusLabel: 'Migration Ready / Draft PR #1 Created',
    lastScanAt: '2026-09-11 00:30 UTC',
    totalFiles: 12,
    providers: ['Stripe'],
    findingsCount: 1,
    primarySdk: 'stripe@16.0.0',
  },
];

export const DEMO_INVENTORY: ProviderIntegration[] = [
  { id: 'stripe', name: 'Stripe', category: 'Payments & Billing', status: 'reviewed', rulesCount: 9, iconName: 'CreditCard' },
  { id: 'twilio', name: 'Twilio', category: 'Telephony & SMS', status: 'reviewed', rulesCount: 2, iconName: 'PhoneCall' },
  { id: 'openai', name: 'OpenAI', category: 'AI & LLM', status: 'detected', rulesCount: 0, iconName: 'Sparkles' },
  { id: 'supabase', name: 'Supabase', category: 'Database & Auth', status: 'detected', rulesCount: 0, iconName: 'Database' },
  { id: 'groq', name: 'Groq', category: 'AI Inference', status: 'detected', rulesCount: 0, iconName: 'Zap' },
  { id: 'dodopayments', name: 'Dodo Payments', category: 'Payments', status: 'detected', rulesCount: 0, iconName: 'Wallet' },
  { id: 'deepgram', name: 'Deepgram', category: 'Voice & Speech', status: 'detected', rulesCount: 0, iconName: 'Mic' },
  { id: 'elevenlabs', name: 'ElevenLabs', category: 'Voice Synthesis', status: 'detected', rulesCount: 0, iconName: 'Volume2' },
  { id: 'sarvam', name: 'Sarvam AI', category: 'Voice & NLP', status: 'detected', rulesCount: 0, iconName: 'Cpu' },
];

export const DEMO_BAVIO_TWILIO_USAGES: ApiUsage[] = [
  {
    id: 'usg-1',
    file: 'backend/providers/twilio.js',
    line: 12,
    symbol: 'twilio(accountSid, authToken)',
    codeSnippet: `const twilio = require('twilio');\nconst client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);`,
    context: 'Client initialization',
  },
  {
    id: 'usg-2',
    file: 'backend/services/twilioPhoneNumberService.js',
    line: 45,
    symbol: 'client.availablePhoneNumbers(country).local.list',
    codeSnippet: `const numbers = await client.availablePhoneNumbers('US').local.list({ limit: 10, voiceEnabled: true });`,
    context: 'Available phone numbers search',
  },
  {
    id: 'usg-3',
    file: 'backend/controllers/numberController.js',
    line: 28,
    symbol: 'client.incomingPhoneNumbers.create',
    codeSnippet: `const purchased = await client.incomingPhoneNumbers.create({ phoneNumber: selectedNumber, voiceUrl: webhookUrl });`,
    context: 'Phone number purchase & webhook provisioning',
  },
  {
    id: 'usg-4',
    file: 'backend/routes/callStream.js',
    line: 19,
    symbol: 'Twilio WebSocket Media Stream',
    codeSnippet: `wss.on('connection', (ws) => {\n  ws.on('message', (message) => {\n    const msg = JSON.parse(message);\n    if (msg.event === 'start') { ... }\n  });\n});`,
    context: 'Bi-directional Audio Stream Session',
  },
  {
    id: 'usg-5',
    file: 'backend/voice/providers/current/CurrentTwilioTelephony.js',
    line: 64,
    symbol: 'client.calls.create',
    codeSnippet: `const call = await client.calls.create({\n  to: destination,\n  from: twilioNumber,\n  url: twimlUrl\n});`,
    context: 'Outbound telephony call dispatch',
  },
];

export const DEMO_FINDING_STRIPE: Finding = {
  id: 'fnd-1',
  changeId: 'stripe-subscription-coupon-removed',
  provider: 'Stripe',
  title: 'Subscription coupon property removed in Stripe Node SDK v17+',
  description: 'The top-level coupon parameter in client.subscriptions.create has been removed in favor of the discounts array.',
  severity: 'high',
  repositoryName: 'apiproof-github-fixture',
  affectedFile: 'src/billing.ts',
  symbol: 'subscriptions.create:coupon',
  status: 'pr_created',
  affectedVersions: '>=16.0.0 <17.0.0',
  targetVersion: '17.0.0',
  sourceUrl: 'https://github.com/stripe/stripe-node/blob/main/CHANGELOG.md',
  oldCode: `return stripe.subscriptions.create({\n  customer: customerId,\n  items: [{ price: priceId }],\n  coupon: couponId\n});`,
  newCode: `return stripe.subscriptions.create({\n  customer: customerId,\n  items: [{ price: priceId }],\n  discounts: [{ coupon: couponId }]\n});`,
  prNumber: 1,
  prUrl: 'https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/1',
};

export const DEMO_VERIFICATION_CHECKS: VerificationCheck[] = [
  { id: 'v1', name: 'Patch Application', status: 'passed', detail: 'AST transformation applied cleanly to src/billing.ts' },
  { id: 'v2', name: 'TypeScript Build & Typecheck', status: 'passed', detail: 'tsc --noEmit passed with zero diagnostics' },
  { id: 'v3', name: 'Unit Test Execution', status: 'passed', detail: 'pnpm test passed (100% assertions green)' },
  { id: 'v4', name: 'API Contract Compliance', status: 'passed', detail: 'Verified payload matches Stripe v17+ API specification' },
];

export const DEMO_PULL_REQUEST: PullRequestSummary = {
  number: 1,
  title: 'APIProof: migrate stripe-subscription-coupon-removed',
  repository: 'apiproof-github-fixture',
  owner: 'ravitejabolla756-sys',
  headBranch: 'apiproof/stripe-subscription-coupon-removed-9cc601a8',
  baseBranch: 'main',
  state: 'draft',
  url: 'https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/1',
  author: 'apiproof-app[bot]',
  humanReviewRequired: true,
  autoMergeEnabled: false,
  patchDigest: 'dd6a85b54d25ee64c911992bb4fd8082b75ee2dfc2c121c99a5b5e1f9a445917',
  createdAt: '2026-09-09 19:35 UTC',
};

export const DEMO_ACTIVITIES: ActivityEvent[] = [
  {
    id: 'act-1',
    timestamp: '2026-09-11 00:54 UTC',
    type: 'scan_completed',
    title: 'Bavio-Ai-v1 scan completed',
    description: 'Scanned 390 files in main branch. 27 Twilio SDK usages indexed. Status: NOT_AFFECTED.',
    repository: 'Bavio-Ai-v1',
    badge: 'Observe Mode',
  },
  {
    id: 'act-2',
    timestamp: '2026-09-11 00:52 UTC',
    type: 'inventory_indexed',
    title: 'Twilio provider usage indexed',
    description: 'Indexed 27 Twilio symbols across 10 backend files including telephony and media streams.',
    repository: 'Bavio-Ai-v1',
    badge: 'SDK v5.12.2',
  },
  {
    id: 'act-3',
    timestamp: '2026-09-09 19:35 UTC',
    type: 'pr_created',
    title: 'Draft PR #1 created',
    description: 'Opened Draft PR on apiproof/stripe-subscription-coupon-removed-9cc601a8 for human review.',
    repository: 'apiproof-github-fixture',
    badge: 'Draft PR #1',
  },
  {
    id: 'act-4',
    timestamp: '2026-09-09 19:34 UTC',
    type: 'migration_verified',
    title: 'Migration verification passed',
    description: 'All 4 verification gates passed (patch applied, tsc build, tests green, contract valid).',
    repository: 'apiproof-github-fixture',
    badge: '4/4 Passed',
  },
  {
    id: 'act-5',
    timestamp: '2026-09-09 19:30 UTC',
    type: 'finding_detected',
    title: 'Stripe deprecation finding detected',
    description: 'stripe-subscription-coupon-removed matched usage in src/billing.ts.',
    repository: 'apiproof-github-fixture',
    badge: 'Breaking Change',
  },
];

export const demoData = {
  repositories: [
    {
      id: 'bavio-ai-v1',
      name: 'Bavio-Ai-v1',
      fullName: 'ravitejabolla756-sys/Bavio-Ai-v1',
      owner: 'ravitejabolla756-sys',
      repositoryId: '1260141355',
      defaultBranch: 'main',
      status: 'healthy' as const,
      statusLabel: 'Healthy / Not Affected',
      lastScanAt: '2026-09-11T00:54:00Z',
      totalFiles: 390,
      providers: ['Twilio', 'OpenAI', 'Supabase', 'Groq', 'Dodo Payments', 'Deepgram', 'ElevenLabs', 'Sarvam', 'Redis'],
      findingsCount: 0,
      usagesCount: 27,
      draftPrCount: 0,
    },
    {
      id: 'apiproof-github-fixture',
      name: 'apiproof-github-fixture',
      fullName: 'ravitejabolla756-sys/apiproof-github-fixture',
      owner: 'ravitejabolla756-sys',
      repositoryId: '1363070568',
      defaultBranch: 'main',
      status: 'pr_created' as const,
      statusLabel: 'Migration Ready / Draft PR Created',
      lastScanAt: '2026-09-09T19:35:00Z',
      totalFiles: 12,
      providers: ['Stripe'],
      findingsCount: 1,
      usagesCount: 1,
      draftPrCount: 1,
    },
  ],

  providerRegistry: [
    { id: 'stripe', name: 'Stripe', category: 'Billing & Payments', status: 'REVIEWED' as const, rulesCount: 1, usagesCount: 1 },
    { id: 'twilio', name: 'Twilio', category: 'Telephony & Voice', status: 'REVIEWED' as const, rulesCount: 1, usagesCount: 27 },
    { id: 'openai', name: 'OpenAI', category: 'AI & Inference', status: 'DETECTED' as const, rulesCount: 0, usagesCount: 0 },
    { id: 'supabase', name: 'Supabase', category: 'Database & Auth', status: 'DETECTED' as const, rulesCount: 0, usagesCount: 0 },
    { id: 'groq', name: 'Groq', category: 'AI & Acceleration', status: 'DETECTED' as const, rulesCount: 0, usagesCount: 0 },
    { id: 'dodo', name: 'Dodo Payments', category: 'Billing & Payments', status: 'DETECTED' as const, rulesCount: 0, usagesCount: 0 },
    { id: 'deepgram', name: 'Deepgram', category: 'Voice & STT', status: 'DETECTED' as const, rulesCount: 0, usagesCount: 0 },
    { id: 'elevenlabs', name: 'ElevenLabs', category: 'Voice & TTS', status: 'DETECTED' as const, rulesCount: 0, usagesCount: 0 },
    { id: 'sarvam', name: 'Sarvam', category: 'Voice & AI', status: 'DETECTED' as const, rulesCount: 0, usagesCount: 0 },
  ],


  findings: [
    {
      id: 'stripe-subscription-coupon-removed',
      title: 'Stripe subscription coupon parameter removed in v17+',
      changeId: 'stripe-subscription-coupon-removed',
      providerId: 'Stripe',
      repositoryId: 'apiproof-github-fixture',
      file: 'src/billing.ts',
      severity: 'breaking' as const,
      detectedAt: '2026-09-09T19:30:00Z',
      description: 'Stripe API v17+ removed the top-level coupon parameter from subscriptions.create(). Migrated to discounts: [{ coupon }].',
      verification: {
        status: 'PASSED',
        checks: DEMO_VERIFICATION_CHECKS,
      },
      pullRequest: {
        number: DEMO_PULL_REQUEST.number,
        title: DEMO_PULL_REQUEST.title,
        url: DEMO_PULL_REQUEST.url,
        state: DEMO_PULL_REQUEST.state,
        branch: DEMO_PULL_REQUEST.headBranch,
      },
    },
  ],

  migrations: [
    {
      id: 'mig-1',
      title: 'Stripe subscription coupon parameter removal',
      providerId: 'Stripe',
      repositoryId: 'apiproof-github-fixture',
      status: 'Draft PR Created',
      verification: {
        checks: DEMO_VERIFICATION_CHECKS,
      },
      pullRequest: {
        number: DEMO_PULL_REQUEST.number,
        url: DEMO_PULL_REQUEST.url,
      },
    },
  ],

  pullRequests: [
    {
      id: 'pr-1',
      number: DEMO_PULL_REQUEST.number,
      title: DEMO_PULL_REQUEST.title,
      repositoryId: DEMO_PULL_REQUEST.repository,
      branch: DEMO_PULL_REQUEST.headBranch,
      state: DEMO_PULL_REQUEST.state,
      url: DEMO_PULL_REQUEST.url,
      createdAt: DEMO_PULL_REQUEST.createdAt,
    },
  ],

  activityEvents: DEMO_ACTIVITIES.map(a => ({
    id: a.id,
    type: a.type.toUpperCase(),
    title: a.title,
    description: a.description,
    repositoryId: a.repository,
    timestamp: a.timestamp,
  })),
};

