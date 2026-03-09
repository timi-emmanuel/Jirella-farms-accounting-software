import { redirect } from "next/navigation";

type LegacyStage = "hatchery" | "fingerlings" | "juvenile" | "growout";

const normalizeStage = (value: string | string[] | undefined): LegacyStage => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "hatchery" || raw === "juvenile" || raw === "growout") return raw;
  return "fingerlings";
};

const stageHrefMap: Record<LegacyStage, string> = {
  hatchery: "/catfish/hatchery/inventory",
  fingerlings: "/catfish/fingerlings/inventory",
  juvenile: "/catfish/juvenile/inventory",
  growout: "/catfish/growout/inventory",
};

export default function LegacyCatfishInventoryPage({
  searchParams,
}: {
  searchParams?: { stage?: string | string[] };
}) {
  const stage = normalizeStage(searchParams?.stage);
  redirect(stageHrefMap[stage]);
}
