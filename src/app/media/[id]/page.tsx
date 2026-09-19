import { MediaDetail } from "@/components/media-detail";

type Props = { params: Promise<{ id: string }> };

export default async function MediaPage({ params }: Props) {
  const { id } = await params;
  return <MediaDetail id={id} />;
}
