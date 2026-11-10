import { SessionScreen } from "@/components/product/session-screen";
export const metadata = { title: "Discussion room" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SessionScreen id={id} stage="live" />;
}
