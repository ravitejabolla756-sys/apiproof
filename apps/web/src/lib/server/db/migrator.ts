import crypto from 'node:crypto';
import type { DatabaseAdapter, Migration, MigrationRecord } from './types.js';
import { POSTGRES_SCHEMA, SQLITE_SCHEMA } from './schema.js';
import { extendedMigrations } from './extended-migrations.js';
import { passwordResetMigrations } from './password-reset-migration.js';
import { verificationWorkerMigrations } from './verification-worker-migration.js';
import { slackMigrations } from './slack-migration.js';
import { slackReliabilityMigrations } from './slack-reliability-migration.js';
import { googleOAuthMigrations } from './google-oauth-migration.js';
import { githubLoginMigrations } from './github-login-migration.js';
import { emailVerificationMigrations } from './email-verification-migration.js';
import { findingLifecycleMigrations } from './finding-lifecycle-migration.js';
import { findingResolutionMigrations } from './finding-resolution-migration.js';
import { memberRevocationMigrations } from './member-revocation-migration.js';
import { workerObservabilityMigrations } from './worker-observability-migration.js';
import { scanWorkerHealthMigrations } from './scan-worker-health-migration.js';
import { providerChangeMonitorMigrations } from './provider-change-monitor-migration.js';
import { skipDefaultSeed } from './seed-policy.js';

export const migrations: Migration[] = [
  {
    id: '001',
    name: 'initial_schema',
    up: async (db: DatabaseAdapter) => {
      const ddl = db.engine === 'postgres' ? POSTGRES_SCHEMA : SQLITE_SCHEMA;
      
      // Execute the schema DDL
      // For multi-statement DDL, we execute statement by statement or as a raw block
      if (db.engine === 'postgres') {
        // Postgres adapter can execute multi-statement DDL in a single execute call
        await db.execute(ddl);
      } else {
        // SQLite execute block
        await db.execute(ddl);
      }

      // Preserve the existing local fixture by default. Staging can opt into
      // schema-only migration and bootstrap its own records separately.
      const userCheck = await db.queryOne<{ id: string }>('SELECT id FROM users LIMIT 1');
      if (!userCheck && !skipDefaultSeed()) {
        const userId = 'usr_pilot_developer';
        const now = new Date().toISOString();
        
        const seedPassword = process.env.APIPROOF_LOCAL_SEED_PASSWORD;
        if (!seedPassword) {
          throw new Error(
            'MISSING_LOCAL_SEED_PASSWORD: APIPROOF_LOCAL_SEED_PASSWORD must be configured when default seeding is enabled.'
          );
        }
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.scryptSync(seedPassword, salt, 64).toString('hex');
        const passwordHash = `${salt}:${hash}`;

        await db.execute(`
          INSERT INTO users (id, email, password_hash, name, created_at)
          VALUES (?, ?, ?, ?, ?)
        `, [userId, 'developer@apiproof.dev', passwordHash, 'APIProof Developer', now]);

        const repoId = 'repo_apiproof_fixture';
        await db.execute(`
          INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, origin, lifecycle, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seeded_fixture', 'historical', ?)
        `, [
          repoId,
          userId,
          'ravitejabolla756-sys',
          'apiproof-github-fixture',
          'ravitejabolla756-sys/apiproof-github-fixture',
          '1363070568',
          'main',
          'connected',
          now
        ]);

        await db.execute(`
          INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          'act_init_repo',
          userId,
          repoId,
          'repository_connected',
          'Repository Connected',
          'Connected ravitejabolla756-sys/apiproof-github-fixture via GitHub App.',
          now
        ]);
      }
    },
  },
  {
    id: '002',
    name: 'phase1_integrity_constraints_and_rate_limits',
    up: async (db: DatabaseAdapter) => {
      const resetAtType = db.engine === 'postgres' ? 'BIGINT' : 'INTEGER';
      await db.execute(`
        CREATE TABLE IF NOT EXISTS rate_limits (
          key TEXT PRIMARY KEY,
          points INTEGER NOT NULL,
          reset_at ${resetAtType} NOT NULL
        )
      `);

      await db.execute(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_identity 
        ON findings(repository_id, change_id, file_path, symbol)
      `);

      await db.execute(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pull_requests_migration 
        ON pull_requests(migration_id)
      `);
    },
  },
  {
    id: '003',
    name: 'phase2_multi_tenant_workspaces_and_installations',
    up: async (db: DatabaseAdapter) => {
      // 1. Create workspaces table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      // 2. Create workspace_members table
      if (db.engine === 'postgres') {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS workspace_members (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE (workspace_id, user_id)
          )
        `);
      } else {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS workspace_members (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE (workspace_id, user_id)
          )
        `);
      }

      // 3. Create github_installations table
      if (db.engine === 'postgres') {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS github_installations (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            installation_id TEXT UNIQUE NOT NULL,
            account_login TEXT NOT NULL,
            account_type TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
      } else {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS github_installations (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            installation_id TEXT UNIQUE NOT NULL,
            account_login TEXT NOT NULL,
            account_type TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
          )
        `);
      }

      // 4. Add workspace_id column to repositories if not exists
      if (db.engine === 'postgres') {
        await db.execute(`
          ALTER TABLE repositories ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE
        `);
      } else {
        const columns = await db.query<{ name: string }>('PRAGMA table_info(repositories)');
        const hasWorkspaceCol = columns.some((c) => c.name === 'workspace_id');
        if (!hasWorkspaceCol) {
          await db.execute('ALTER TABLE repositories ADD COLUMN workspace_id TEXT');
        }
      }

      // 5. Create indexes
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_github_installations_workspace ON github_installations(workspace_id)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_repositories_workspace ON repositories(workspace_id)`);

      // 6. Data migration: Migrate existing users to default workspaces without repository loss
      const users = await db.query<{ id: string; email: string; name: string; created_at: string }>(
        'SELECT id, email, name, created_at FROM users'
      );

      for (const u of users) {
        // Check if user already belongs to any workspace
        const existingMember = await db.queryOne<{ workspace_id: string }>(
          'SELECT workspace_id FROM workspace_members WHERE user_id = ?',
          [u.id]
        );

        let wsId: string;
        if (existingMember) {
          wsId = existingMember.workspace_id;
        } else {
          wsId = `ws_${u.id.replace(/^usr_/, '')}`;
          const cleanEmail = u.email ? u.email.split('@')[0]!.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'workspace';
          const slug = `${cleanEmail}-${u.id.slice(4, 10)}`;
          const wsName = `${u.name || 'User'}'s Workspace`;
          const memberId = `wsm_${u.id.replace(/^usr_/, '')}`;
          const now = u.created_at || new Date().toISOString();

          // Idempotent workspace check
          const existingWs = await db.queryOne<{ id: string }>(
            'SELECT id FROM workspaces WHERE id = ? OR slug = ?',
            [wsId, slug]
          );

          if (!existingWs) {
            await db.execute(
              'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
              [wsId, wsName, slug, now, now]
            );
          } else {
            wsId = existingWs.id;
          }

          await db.execute(
            'INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (workspace_id, user_id) DO NOTHING',
            [memberId, wsId, u.id, 'owner', now]
          );
        }

        // Migrate repositories previously associated with user_id
        await db.execute(
          "UPDATE repositories SET workspace_id = ? WHERE user_id = ? AND (workspace_id IS NULL OR workspace_id = '')",
          [wsId, u.id]
        );
      }
    },
  },
  {
    id: '004',
    name: 'phase3b_github_webhooks_and_synchronization',
    up: async (db: DatabaseAdapter) => {
      // 1. Ensure status column on github_installations
      if (db.engine === 'postgres') {
        await db.execute("ALTER TABLE github_installations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'");
      } else {
        const colCheck = await db.query<{ name: string }>("PRAGMA table_info(github_installations)");
        if (!colCheck.some((c) => c.name === 'status')) {
          await db.execute("ALTER TABLE github_installations ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
        }
      }

      // 2. Create github_webhook_deliveries
      await db.execute(`
        CREATE TABLE IF NOT EXISTS github_webhook_deliveries (
          id TEXT PRIMARY KEY,
          event TEXT NOT NULL,
          status TEXT NOT NULL,
          received_at TEXT NOT NULL,
          processed_at TEXT NOT NULL,
          error_message TEXT
        )
      `);

      // 3. Create github_scan_requests

      if (db.engine === 'postgres') {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS github_scan_requests (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
            commit_sha TEXT NOT NULL,
            ref TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            delivery_id TEXT,
            created_at TEXT NOT NULL,
            UNIQUE (repository_id, commit_sha)
          )
        `);
      } else {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS github_scan_requests (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            repository_id TEXT NOT NULL,
            commit_sha TEXT NOT NULL,
            ref TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            delivery_id TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
            FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
            UNIQUE (repository_id, commit_sha)
          )
        `);
      }

      // 4. Create indexes
      await db.execute('CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON github_webhook_deliveries(event)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_scan_requests_repo ON github_scan_requests(repository_id)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_scan_requests_status ON github_scan_requests(status)');
    },
  },
  {
    id: '005',
    name: 'phase3a_github_installation_states',
    up: async (db: DatabaseAdapter) => {
      const expiresAtType = db.engine === 'postgres' ? 'BIGINT' : 'INTEGER';
      const consumedAtType = db.engine === 'postgres' ? 'BIGINT' : 'INTEGER';

      if (db.engine === 'postgres') {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS github_installation_states (
            state TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            expires_at ${expiresAtType} NOT NULL,
            consumed_at ${consumedAtType},
            created_at TEXT NOT NULL
          )
        `);
      } else {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS github_installation_states (
            state TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            expires_at ${expiresAtType} NOT NULL,
            consumed_at ${consumedAtType},
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
          )
        `);
      }

      await db.execute('CREATE INDEX IF NOT EXISTS idx_installation_states_user ON github_installation_states(user_id)');
    },
  },
  {
    id: '006',
    name: 'phase7_workspace_subscriptions_and_usage',
    up: async (db: DatabaseAdapter) => {
      // 1. Create workspace_subscriptions table
      if (db.engine === 'postgres') {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS workspace_subscriptions (
            workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
            plan_id TEXT NOT NULL DEFAULT 'free',
            customer_id TEXT,
            subscription_id TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            current_period_start TEXT NOT NULL,
            current_period_end TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
      } else {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS workspace_subscriptions (
            workspace_id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL DEFAULT 'free',
            customer_id TEXT,
            subscription_id TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            current_period_start TEXT NOT NULL,
            current_period_end TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
          )
        `);
      }

      // 2. Create workspace_usage table
      if (db.engine === 'postgres') {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS workspace_usage (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            metric TEXT NOT NULL,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE (workspace_id, metric, period_start)
          )
        `);
      } else {
        await db.execute(`
          CREATE TABLE IF NOT EXISTS workspace_usage (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            metric TEXT NOT NULL,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
            UNIQUE (workspace_id, metric, period_start)
          )
        `);
      }

      // 3. Create billing_webhook_events table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS billing_webhook_events (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload_hash TEXT NOT NULL,
          processed_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE (provider, payload_hash)
        )
      `);

      // 4. Create indexes
      await db.execute('CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_customer ON workspace_subscriptions(customer_id)');
      await db.execute('CREATE INDEX IF NOT EXISTS idx_workspace_usage_period ON workspace_usage(workspace_id, period_start)');
    },
  },
  {
    id: '007',
    name: 'phase9_migration_baseline_sha',
    up: async (db: DatabaseAdapter) => {
      // Check if migrations table exists
      const tableCheck = db.engine === 'postgres'
        ? await db.queryOne<{ exists: boolean }>("SELECT to_regclass('public.migrations') IS NOT NULL AS exists")
        : await db.queryOne<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'");

      const tableExists = db.engine === 'postgres' ? (tableCheck as { exists?: boolean })?.exists : Boolean(tableCheck);
      if (!tableExists) {
        return;
      }

      // 1. Add baseline_sha column to migrations table if not exists
      if (db.engine === 'postgres') {
        await db.execute('ALTER TABLE migrations ADD COLUMN IF NOT EXISTS baseline_sha TEXT');
      } else {
        const columns = await db.query<{ name: string }>('PRAGMA table_info(migrations)');
        if (!columns.some((c) => c.name === 'baseline_sha')) {
          await db.execute('ALTER TABLE migrations ADD COLUMN baseline_sha TEXT');
        }
      }

      // 2. Backfill baseline_sha for existing migrations using finding -> scan association
      await db.execute(`
        UPDATE migrations
        SET baseline_sha = (
          SELECT s.sha
          FROM findings f
          JOIN scans s ON f.scan_id = s.id
          WHERE f.id = migrations.finding_id
        )
        WHERE baseline_sha IS NULL OR baseline_sha = ''
      `);
    },
  },
  ...extendedMigrations,
  ...passwordResetMigrations,
  ...verificationWorkerMigrations,
  ...slackMigrations,
  ...slackReliabilityMigrations,
  ...providerChangeMonitorMigrations,
  ...googleOAuthMigrations,
  ...githubLoginMigrations,
  ...emailVerificationMigrations,
  ...findingLifecycleMigrations,
  ...findingResolutionMigrations,
  ...memberRevocationMigrations,
  ...scanWorkerHealthMigrations,
  ...workerObservabilityMigrations,
];

async function runMigrationsUnlocked(db: DatabaseAdapter): Promise<MigrationRecord[]> {
  // Ensure the migrations tracking table exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _apiproof_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const appliedRows = await db.query<{ id: string }>('SELECT id FROM _apiproof_migrations');
  const appliedSet = new Set(appliedRows.map((r) => r.id));

  const newlyApplied: MigrationRecord[] = [];

  for (const migration of migrations) {
    if (!appliedSet.has(migration.id)) {
      const now = new Date().toISOString();
      await db.transaction(async (tx) => {
        await migration.up(tx);
        await tx.execute(
          'INSERT INTO _apiproof_migrations (id, name, applied_at) VALUES (?, ?, ?)',
          [migration.id, migration.name, now]
        );
      });

      newlyApplied.push({
        id: migration.id,
        name: migration.name,
        appliedAt: now,
      });
    }
  }

  return newlyApplied;
}

export async function runMigrations(db: DatabaseAdapter): Promise<MigrationRecord[]> {
  if (db.engine !== 'postgres') {
    return runMigrationsUnlocked(db);
  }

  // Vercel can cold-start several functions at once. Keep the advisory lock and
  // all migration work on one transaction-owned PostgreSQL connection so two
  // cold starts cannot concurrently create the same schema object.
  return db.transaction(async (tx) => {
    await tx.execute("SELECT pg_advisory_xact_lock(hashtext('apiproof:application-migrations'))");
    return runMigrationsUnlocked(tx);
  });
}
