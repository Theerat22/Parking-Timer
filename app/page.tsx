import ParkingApp from "@/components/parking-app";
import { isConfigured } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default function Page() {
  return <ParkingApp configured={isConfigured()} />;
}
