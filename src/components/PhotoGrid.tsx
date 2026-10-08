import Image from "next/image";
import type { Photo } from "@/content/photos";

/**
 * "wide" keeps each photo's own shape in two columns (course panoramas).
 * "tiles" crops to a uniform 4:3 in three columns (small, mixed-size photos).
 */
export function PhotoGrid({
  photos,
  layout = "wide",
}: {
  photos: Photo[];
  layout?: "wide" | "tiles";
}) {
  const tiles = layout === "tiles";

  return (
    <ul className={`grid gap-3 ${tiles ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      {photos.map((photo) => (
        <li key={photo.src.src}>
          <Image
            src={photo.src}
            alt={photo.alt}
            placeholder="blur"
            sizes={
              tiles
                ? "(min-width: 768px) 240px, (min-width: 640px) 33vw, 100vw"
                : "(min-width: 768px) 368px, (min-width: 640px) 50vw, 100vw"
            }
            className={`w-full rounded-lg ${tiles ? "aspect-[4/3] object-cover" : "h-auto"}`}
          />
        </li>
      ))}
    </ul>
  );
}
