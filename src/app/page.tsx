import { headers } from "next/headers";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Expertise from "@/components/Expertise";
import Contributions from "@/components/Contributions";
import TechStack from "@/components/TechStack";
import Experience from "@/components/Experience";
import Projects from "@/components/Projects";
import Certifications from "@/components/Certifications";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import AmbientBackground from "@/components/AmbientBackground";
import ScrollProgress from "@/components/ScrollProgress";
import BlogTeaser from "@/components/BlogTeaser";
import { navUrls } from "@/lib/site";

export default async function Home() {
  const urls = navUrls((await headers()).get("host") ?? "");

  return (
    <>
      <AmbientBackground />
      <ScrollProgress />
      <Navbar homeHref={urls.homeHref} blogHref={urls.blogHref} />
      <main className="relative z-10">
        <Hero />
        <About />
        <Expertise />
        <Experience />
        <Contributions />
        <TechStack />
        <Projects />
        <BlogTeaser />
        <Certifications />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
