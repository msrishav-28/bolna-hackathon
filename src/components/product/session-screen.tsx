"use client";
import dynamic from "next/dynamic";
import { ApiError } from "@/lib/client/api";
import { useProductResource } from "@/lib/client/use-product-resource";
import { sessionResponseSchema } from "@/lib/product-contracts";
import { BusyState, ErrorPanel } from "./shared";
import { MicrophoneCheck } from "./microphone-check";
import { Processing } from "./processing";
import { Scorecard } from "./scorecard";
const LiveRoom = dynamic(() => import("./live-room"), {
  loading: () => <BusyState label="Opening your room…" />,
});
const pendingSession = (data: { session: { status: string } }) =>
  !["completed", "failed", "expired"].includes(data.session.status);

export function SessionScreen({
  id,
  stage,
}: {
  id: string;
  stage: "check" | "live" | "processing" | "report";
}) {
  const resource = useProductResource(
    `/api/sessions/${encodeURIComponent(id)}`,
    sessionResponseSchema,
    stage === "processing" || stage === "report" ? 4000 : 0,
    pendingSession,
  );
  if (resource.loading)
    return (
      <main id="main" tabIndex={-1} className="product-main">
        <BusyState label="Loading your round…" />
      </main>
    );
  if (resource.error || !resource.data || resource.data.session.id !== id)
    return (
      <main id="main" tabIndex={-1} className="product-main">
        <ErrorPanel
          error={
            resource.error ??
            new ApiError(
              "We couldn’t find this round in your account.",
              "SESSION_NOT_FOUND",
            )
          }
          retry={resource.retry}
          back="/history"
        />
      </main>
    );
  const session = resource.data.session;
  if (stage === "report" && session.status === "completed")
    return <Scorecard session={session} />;
  if (stage === "check" && session.status === "created")
    return <MicrophoneCheck session={session} />;
  if (stage === "live") return <LiveRoom session={session} />;
  return <Processing session={session} retry={resource.retry} />;
}
