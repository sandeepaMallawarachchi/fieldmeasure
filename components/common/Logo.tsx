import Image from "next/image";
import { APP_NAME } from "@/config/app";
import { LOGO_SIZE, LOGO_SRC } from "@/lib/brand";

/**
 * Served directly rather than through the image optimizer, whose responses
 * aren't in the service worker's cache and so wouldn't load offline.
 */
export function Logo() {
  return (
    <Image
      src={LOGO_SRC}
      alt={APP_NAME}
      width={LOGO_SIZE.width}
      height={LOGO_SIZE.height}
      unoptimized
      priority
      className="h-13 w-auto"
    />
  );
}
