import { LandingNavbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/footer";
import { ArrowUpRight } from "lucide-react";

export default function BlogPage() {
  const posts = [
    {
      slug: "stripe-subscription-coupon-migration",
      category: "API Migration Guide",
      title: "Understanding Stripe subscription coupon migration in Node SDK v17+",
      excerpt: "Stripe v17 removed top-level coupon parameters in subscriptions.create(). Learn how MY OWL automatically detects affected call sites and generates discounts array refactors.",
      readTime: "4 min read",
      date: "Sample Engineering Note",
    },
    {
      slug: "distinguishing-detected-from-affected",
      category: "Engine Architecture",
      title: "How MY OWL distinguishes detected dependencies from affected usage",
      excerpt: "Having a dependency in package.json does not mean your application breaks. Explore our AST symbol matching engine and zero-noise classification.",
      readTime: "6 min read",
      date: "Sample Architecture Guide",
    },
    {
      slug: "review-only-migration-architecture",
      category: "Security & Trust",
      title: "Inside MY OWL's review-only migration architecture",
      excerpt: "Why MY OWL never auto-merges pull requests or commits directly to default branches, maintaining strict human-in-the-loop review invariants.",
      readTime: "5 min read",
      date: "Sample Security Note",
    },
    {
      slug: "twilio-zero-noise-verification",
      category: "Provider Intelligence",
      title: "Zero-noise compatibility verification for Twilio API changes",
      excerpt: "A deep dive into how MY OWL indexed 27 call sites across Bavio-Ai-v1 and verified 0 matching breaking changes against Twilio SDK updates.",
      readTime: "7 min read",
      date: "Sample Case Study",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F6F6F4] text-[#111111] font-sans selection:bg-[#111111] selection:text-white">
      <LandingNavbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-12 md:py-20 space-y-12">

        {/* HEADER */}
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E8E8E5] text-[11px] font-semibold uppercase tracking-wider text-[#686868]">
            CHANGE INTELLIGENCE
          </div>
          <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-[#111111]">
            Engineering Notes & Change Explainers
          </h1>
          <p className="text-base text-[#686868]">
            Technical breakdowns of vendor API breaking changes, AST parsing algorithms, and migration safety patterns.
          </p>
        </div>

        {/* ARTICLES GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {posts.map((post) => (
            <article
                key={post.slug}
                className="rounded-[28px] bg-white border border-[#E8E8E5] p-8 space-y-5 hover:border-[#111111]/30 transition-all shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#686868]">
                    <span className="px-3 py-1 rounded-full bg-[#F6F6F4] border border-[#E8E8E5] font-medium text-[#111111]">
                      {post.category}
                    </span>
                    <span>{post.readTime}</span>
                  </div>

                  <h2 className="text-xl font-semibold text-[#111111] leading-snug group-hover:text-blue-600 transition-colors">
                    {post.title}
                  </h2>

                  <p className="text-xs sm:text-sm text-[#686868] leading-relaxed">
                    {post.excerpt}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E8E8E5] flex items-center justify-between text-xs font-medium text-[#111111]">
                  <span>{post.date}</span>
                  <span className="flex items-center gap-1 text-blue-600">
                    Read article <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </article>
          ))}
        </div>

      </main>

      <LandingFooter />
    </div>
  );
}
