import { MediaVaultDashboard } from "@/components/media-vault-dashboard";
import { fetchMediaFromDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const items = (await fetchMediaFromDatabase().catch(() => null)) ?? [];
  return <MediaVaultDashboard initialItems={items} initialSource="postgres" />;
}
