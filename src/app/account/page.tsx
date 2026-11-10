import { Account } from "@/components/product/account";
import { authConfigured, emailVerificationRequired } from "@/lib/server/config";
import { authClient } from "@/lib/server/supabase";
import { redirect } from "next/navigation";
import { connection } from "next/server";
export const metadata = { title: "Your account" };
export default async function Page() {
  await connection();
  if (!authConfigured()) redirect("/auth?next=%2Faccount");
  const { data } = await (await authClient()).auth.getUser();
  if (!data.user) redirect("/auth?next=%2Faccount");
  return (
    <Account
      email={data.user.email}
      emailRecoveryEnabled={emailVerificationRequired()}
    />
  );
}
