import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Sarvodaya Kumar | Senior Software Engineer",
  description:
    "Senior Software Engineer in Bangalore with 5+ years in Go microservices, Kubernetes, Terraform, and Azure.",
  keywords: [
    "Senior Software Engineer",
    "Golang",
    "Kubernetes",
    "Terraform",
    "Azure",
    "DevOps",
  ],
  authors: [{ name: "Sarvodaya Kumar" }],
  openGraph: {
    title: "Sarvodaya Kumar | Senior Software Engineer",
    description:
      "Senior Software Engineer with 5+ years in microservices, CI/CD, Kubernetes, and Terraform on Azure.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${syne.variable} h-full scroll-smooth`}
    >
      <body className="min-h-full bg-[#0b0d12] text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
