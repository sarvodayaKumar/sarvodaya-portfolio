import { profile } from "@/data/profile";

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 px-6 py-8 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="font-mono text-sm text-zinc-500">
          © {new Date().getFullYear()} {profile.name}. Built with Next.js.
        </p>
        <p className="max-w-md text-center text-xs text-zinc-600 sm:text-right">
          Senior software engineer — distributed systems, observability, cloud platforms.
        </p>
      </div>
    </footer>
  );
}
