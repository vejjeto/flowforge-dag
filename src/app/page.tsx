import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { listWorkflows } from "@/db/repository";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { id } = await searchParams;
  const workflows = await listWorkflows();

  return (
    <StudioWorkspace initialWorkflows={workflows} initialSelectedId={id} />
  );
}
