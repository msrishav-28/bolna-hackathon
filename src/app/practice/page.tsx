import { Setup } from "@/components/product/setup";
import { difficultySchema } from "@/lib/domain/samvaad";
import { redirect } from "next/navigation";
export const metadata = { title: "Choose your round" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    topic?: string;
    difficulty?: string;
    duration?: string;
    mode?: string;
    from?: string;
    view?: string;
  }>;
}) {
  const query = await searchParams;
  if (query.view === "history") redirect("/history");
  return (
    <Setup
      initial={{
        topic: query.topic,
        difficulty: difficultySchema
          .catch("standard")
          .parse(query.difficulty?.toLowerCase()),
        duration: query.duration === "300" ? 300 : 180,
        mode: query.mode,
        from: query.from,
      }}
    />
  );
}
