import { createFileRoute } from "@tanstack/react-router";
import { VarshaSetuLanding } from "@/components/VarshaSetuLanding";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Varsha Setu | Hyperlocal Monsoon Intelligence" },
      {
        name: "description",
        content:
          "AI-powered hyperlocal monsoon prediction and crop advisory for Karnataka farmers by Team Nexus, SIH 2026.",
      },
      { property: "og:title", content: "Varsha Setu | Hyperlocal Monsoon Intelligence" },
      {
        property: "og:description",
        content: "Field-level monsoon intelligence and crop advice for Karnataka farmers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <VarshaSetuLanding />;
}
