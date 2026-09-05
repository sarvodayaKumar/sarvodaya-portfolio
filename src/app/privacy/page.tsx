import type { Metadata } from "next";
import SiteChrome from "@/components/SiteChrome";
import { profile } from "@/data/profile";

export const metadata: Metadata = {
  title: "Privacy Policy | Sarvodaya Kumar",
  description: "Privacy policy for sarvodaya.dev and blog.sarvodaya.dev.",
};

export default function PrivacyPage() {
  return (
    <SiteChrome>
      <main className="relative z-10 mx-auto max-w-3xl px-6 pt-32 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-accent">Legal</p>
        <h1 className="mt-3 font-[family-name:var(--font-syne)] text-4xl font-semibold text-foreground">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-muted">Last updated: September 2026</p>

        <div className="blog-prose mt-10 space-y-6">
          <p>
            This site (sarvodaya.dev and blog.sarvodaya.dev) is a personal portfolio and blog run
            by {profile.name}. This policy explains what data is collected when you visit and how
            it&apos;s used.
          </p>

          <h2>Hosting and server logs</h2>
          <p>
            The site is hosted on Vercel, which automatically logs standard request data (IP
            address, browser user agent, requested URL, timestamp) for operational and security
            purposes. This site owner does not separately collect or store this data.
          </p>

          <h2>Comments</h2>
          <p>
            The comment form on blog posts sends what you enter (name, optional email, and your
            message) directly to {profile.name.split(" ")[0]}&apos;s email inbox via your own
            email client. It is not posted publicly on this site, and no comment data is stored
            on this site&apos;s servers.
          </p>

          <h2>Advertising</h2>
          <p>
            This site may display ads served by Google AdSense. Google and its partners use
            cookies to serve ads based on your prior visits to this site or other websites. You
            can opt out of personalized advertising by visiting{" "}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Ads Settings
            </a>
            , or generally at{" "}
            <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer">
              www.aboutads.info
            </a>
            . More detail on how Google uses data from sites that use its services is available at{" "}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
            >
              policies.google.com/technologies/partner-sites
            </a>
            .
          </p>

          <h2>Cookies</h2>
          <p>
            Aside from cookies set by Google AdSense (where active) for ad personalization, this
            site does not set its own tracking or analytics cookies.
          </p>

          <h2>Children&apos;s privacy</h2>
          <p>This site is not directed at children under 13 and does not knowingly collect data from them.</p>

          <h2>Contact</h2>
          <p>
            Questions about this policy can be sent to{" "}
            <a href={`mailto:${profile.links.email}`}>{profile.links.email}</a>.
          </p>
        </div>
      </main>
    </SiteChrome>
  );
}
