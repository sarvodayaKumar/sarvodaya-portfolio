import { headers } from "next/headers";
import AmbientBackground from "@/components/AmbientBackground";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ScrollProgress from "@/components/ScrollProgress";
import { navUrls } from "@/lib/site";

export default async function SiteChrome({ children }: { children: React.ReactNode }) {
  const urls = navUrls((await headers()).get("host") ?? "");

  return (
    <>
      <AmbientBackground />
      <ScrollProgress />
      <Navbar homeHref={urls.homeHref} blogHref={urls.blogHref} />
      {children}
      <Footer />
    </>
  );
}
