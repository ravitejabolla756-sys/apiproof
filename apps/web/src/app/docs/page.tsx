import React from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import {
  Terminal,
  BookOpen,
  ArrowRight
} from "lucide-react";

export default function DocsPage() {
  const docCategories = [
    {
      id: "getting-started",
      name: "Getting Started",
      description: "Step-by-step setup guides to connect your GitHub organization, configure repositories, and run an initial AST scan.",
      articles: [
        {
          title: "Connecting the GitHub App",
          slug: "connect-github",
          desc: "How to install the official MY OWL GitHub App and authorize specific organizations or repositories."
        },
        {
          title: "Selecting Protected Repositories",
          slug: "select-repositories",
          desc: "Configuring which repositories are continuously monitored for upstream breaking changes."
        },
        {
          title: "Triggering Your First AST Scan",
          slug: "first-scan",
          desc: "Initiating a baseline scan from the dashboard and understanding the scan worker lifecycle."
        }
      ]
    },
    {
      id: "core-concepts",
      name: "Core Concepts",
      description: "The fundamental architectural concepts behind MY OWL's detection, tracing, and verification engines.",
      articles: [
        {
          title: "Findings: Open vs. Resolved",
          slug: "findings-lifecycle",
          desc: "How findings are detected, tracked, and updated across multiple repository re-scans."
        },
        {
          title: "Detected vs. Affected Usage",
          slug: "detected-vs-affected",
          desc: "Why package manifest presence does not mean broken code, and how AST symbol tracing eliminates 90% false positive noise."
        },
        {
          title: "Deterministic Migration Plans",
          slug: "migration-plans",
          desc: "How context-bounded AST transformation rules synthesize minimal, syntax-safe code replacements."
        },
        {
          title: "The 4-Gate Verification Harness",
          slug: "verification-harness",
          desc: "Deep dive into AST syntax validity, TypeScript compiler diagnostics, call-site scope checks, and test runner dry-runs."
        },
        {
          title: "GitHub Draft Pull Requests",
          slug: "draft-prs",
          desc: "Why MY OWL stops at a Draft PR on an isolated branch rather than auto-merging into main."
        }
      ]
    },
    {
      id: "github-integration",
      name: "GitHub Integration & Permissions",
      description: "Permissions, authentication mechanics, branch policies, and baseline integrity protection.",
      articles: [
        {
          title: "GitHub App Scopes & Least Privilege",
          slug: "github-scopes",
          desc: "Detailed explanation of why we request contents:read and pull_requests:write, with zero main branch write access."
        },
        {
          title: "Isolated Branch Policy (apiproof/*)",
          slug: "branch-policy",
          desc: "How branch naming conventions prevent accidental collisions with developer branches."
        },
        {
          title: "Repository Divergence Protection",
          slug: "divergence-protection",
          desc: "How MY OWL verifies that default branch HEAD hasn't moved since the scan, failing closed if divergence occurs."
        }
      ]
    },
    {
      id: "security",
      name: "Security & Verification Boundaries",
      description: "Authentication, tenant isolation, webhook HMAC validation, and signed execution evidence.",
      articles: [
        {
          title: "Workspace Multi-Tenancy",
          slug: "tenant-isolation",
          desc: "How user permissions, repositories, and scan findings are partitioned securely across workspaces."
        },
        {
          title: "Webhook Signature Validation",
          slug: "webhook-validation",
          desc: "Verifying GitHub webhook delivery authenticity with HMAC-SHA256 signatures."
        },
        {
          title: "Execution-Bound Verification Evidence",
          slug: "verification-evidence",
          desc: "Cryptographic binding of repository ID, baseline commit SHA, change ID, and patch digest."
        }
      ]
    },
    {
      id: "supported-apis",
      name: "Supported APIs & Rule Catalogs",
      description: "Currently verified vendor catalogs and our active integration expansion roadmap.",
      articles: [
        {
          title: "Stripe Node SDK Catalog",
          slug: "stripe-catalog",
          desc: "Monitored subscription coupon parameters, customer creation payloads, and v17 to v18 migration rules."
        },
        {
          title: "Twilio Node SDK Catalog",
          slug: "twilio-catalog",
          desc: "Monitored messaging service changes, toll-free verification schemas, and call recording API updates."
        },
        {
          title: "Planned Provider Roadmap",
          slug: "roadmap-providers",
          desc: "Upcoming support for OpenAI, GitHub Octokit, Supabase, Resend, and custom OpenAPI schema ingestion."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#000E29] font-sans antialiased selection:bg-[#D0F100] selection:text-black">
      <LandingNavbar />

      <main id="main-content" tabIndex={-1} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 space-y-16 outline-none">

        {/* HEADER */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 text-xs font-mono font-medium">
            <BookOpen className="w-3.5 h-3.5 text-slate-700" />
            <span>TECHNICAL DOCUMENTATION</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl font-normal text-[#000E29] tracking-tight leading-[1.1]">
            MY OWL Documentation
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Comprehensive reference guides, architecture deep-dives, verification contracts, and API integration specifications.
          </p>
        </div>

        {/* QUICK SEARCH / INTRO BAR */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono shadow-xs">
          <div className="flex items-center gap-3 text-slate-700">
            <Terminal className="w-4 h-4 text-[#004EE8]" />
            <span>Core Model: Ingest → AST Trace → Deterministic Plan → 4 Gates → Draft PR</span>
          </div>
          <Link
            href="/how-it-works"
            className="text-[#004EE8] hover:underline flex items-center gap-1 font-semibold"
          >
            <span>View 9-Stage Pipeline Specification</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* DOCUMENTATION CATEGORIES & TOPICS */}
        <div className="space-y-12">
          {docCategories.map((category) => (
            <section
              key={category.id}
              id={category.id}
              className="rounded-3xl bg-white border border-slate-200/80 p-8 sm:p-10 space-y-6 shadow-xs"
            >
              {/* Category Header */}
              <div className="pb-4 border-b border-slate-100 space-y-1">
                <span className="text-xs font-mono font-bold text-[#004EE8] uppercase tracking-wider">
                  {category.name}
                </span>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
                  {category.description}
                </p>
              </div>

              {/* Articles Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {category.articles.map((art) => (
                  <div
                    key={art.slug}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5 flex flex-col justify-between hover:border-slate-300 transition-colors group"
                  >
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-sm text-[#000E29] group-hover:text-[#004EE8] transition-colors">
                        {art.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed font-sans">
                        {art.desc}
                      </p>
                    </div>

                    <div className="pt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                      <span>docs/{category.id}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-[#004EE8] transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* BOTTOM HELP BANNER */}
        <div className="rounded-3xl bg-[#000E29] text-white p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h3 className="font-serif text-2xl font-normal">
              Have technical questions or custom API requirements?
            </h3>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Explore our engineering articles on AST analysis and verification, or reach out to our team for custom rule integration.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/blog"
              className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-mono font-medium transition-colors border border-white/10"
            >
              Engineering Blog
            </Link>
            <Link
              href="/contact"
              className="btn-lime px-5 py-2.5 rounded-full text-xs font-mono font-bold text-black shadow-sm"
            >
              Contact Us
            </Link>
          </div>
        </div>

      </main>

      <LandingFooter />
    </div>
  );
}
