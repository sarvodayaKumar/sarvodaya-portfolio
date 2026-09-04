import { Download } from "lucide-react";
import { profile } from "@/data/profile";

export default function ResumeLink({
  className = "",
}: {
  className?: string;
}) {
  return (
    <a
      href={profile.resumeUrl}
      download="Sarvodaya-Kumar-Resume.pdf"
      className={className}
    >
      <Download size={15} />
      Resume
    </a>
  );
}
