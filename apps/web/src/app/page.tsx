import { HomeIntro } from "@/shared/info/home-intro";
import { HomePreview } from "@/shared/info/home-preview";

export default function HomePage() {
  return (
    <section aria-labelledby="overview-title" className="pb-8 md:pb-12" id="overview">
      <HomeIntro />
      <HomePreview />
    </section>
  );
}
