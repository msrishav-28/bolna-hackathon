import { redirect } from "next/navigation";
export const metadata = { title: "Your practice" };
export default function Page() {
  redirect("/practice");
}
