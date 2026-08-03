import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-shell";

export const Route = createFileRoute("/_authenticated/scheduler")({
  head: () => ({
    meta: [
      { title: "Scheduler — AI Influencer Factory" },
      { name: "description", content: "Queue posts across social platforms." },
    ],
  }),
  component: SchedulerPage,
});

function SchedulerPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Publish"
        title="Scheduler"
        description="Plan publications across Instagram, TikTok, X and more. Track state: draft, queued, published."
      />
      <EmptyState
        icon={<CalendarClock className="h-5 w-5" />}
        title="Nothing scheduled"
        description="Once you draft a post, pick a platform and a date — it will show up on the calendar here."
      />
    </div>
  );
}
