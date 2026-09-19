import { NextResponse } from "next/server";
import { categories as seedCategories, mediaItems as seedMediaItems, type MediaItem, type MediaType, typeLabels } from "@/lib/media";
import { fetchMediaFromDatabase } from "@/lib/db";

function buildCategories(items: MediaItem[]) {
  return Object.entries(typeLabels).map(([type, label]) => {
    const typedItems = items.filter((item) => item.type === type);
    return {
      type: type as MediaType,
      label,
      count: typedItems.length,
      latest: typedItems[0]?.title ?? "Aucun contenu",
    };
  });
}

export async function GET() {
  try {
    const databaseItems = await fetchMediaFromDatabase();
    const items = databaseItems?.length ? databaseItems : seedMediaItems;

    return NextResponse.json({
      items,
      categories: databaseItems?.length ? buildCategories(items) : seedCategories,
      meta: {
        total: items.length,
        source: databaseItems?.length ? "postgres" : "seed",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        items: seedMediaItems,
        categories: seedCategories,
        meta: {
          total: seedMediaItems.length,
          source: "seed-fallback",
          error: error instanceof Error ? error.message : "Database error",
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 200 },
    );
  }
}
