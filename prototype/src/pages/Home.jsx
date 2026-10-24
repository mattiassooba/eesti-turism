import HomeHero from "./home/HomeHero.jsx";
import TrendSection from "./home/TrendSection.jsx";
import VisitorsSection from "./home/VisitorsSection.jsx";
import MapSection from "./home/MapSection.jsx";
import AccommodationSection from "./home/AccommodationSection.jsx";
import SeasonalitySection from "./home/SeasonalitySection.jsx";
import { SectorPreview, ResidentsPreview } from "./home/NationalSections.jsx";
import InsightsSection from "./home/InsightsSection.jsx";
import ExploreSection from "./home/ExploreSection.jsx";

export default function Home() {
  return (
    <>
      <HomeHero />
      <TrendSection />
      <VisitorsSection />
      <MapSection />
      <AccommodationSection />
      <SeasonalitySection />
      <SectorPreview />
      <ResidentsPreview />
      <InsightsSection />
      <ExploreSection />
    </>
  );
}
