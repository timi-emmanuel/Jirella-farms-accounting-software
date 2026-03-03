import { redirect } from "next/navigation";

export default async function CatfishBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/catfish/fingerlings/${id}`);
}
