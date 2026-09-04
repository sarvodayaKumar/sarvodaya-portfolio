import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import PageLoader from "@/components/PageLoader";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sarvodaya Kumar | Cloud Backend Developer",
  description:
    "Cloud backend developer in Bangalore — Go microservices, Azure, Kubernetes, Terraform, and production CI/CD.",
  keywords: [
    "Cloud Backend Developer",
    "Golang",
    "Azure",
    "Kubernetes",
    "Terraform",
    "DevOps",
  ],
  authors: [{ name: "Sarvodaya Kumar" }],
  openGraph: {
    title: "Sarvodaya Kumar | Cloud Backend Developer",
    description:
      "Go backends, Azure platforms, Kubernetes delivery, and Terraform providers.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${syne.variable} h-full scroll-smooth`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <ThemeProvider>
          <PageLoader>{children}</PageLoader>
        </ThemeProvider>
      </body>
    </html>
  );
}
