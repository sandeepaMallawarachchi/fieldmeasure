"use client";

import { useEffect, useRef, useState } from "react";
import { MapController } from "@/lib/map/mapController";
import { t } from "@/lib/i18n";
import { measurementStore } from "@/store/measurementStore";

/**
 * Creates the map once. Nothing here depends on measurement state: updates reach
 * the controller through the store, so GPS fixes never re-render this component.
 */
export default function LandMap({
  onReady,
}: {
  onReady: (controller: MapController | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let controller: MapController;
    try {
      controller = new MapController(container, measurementStore);
    } catch {
      // No WebGL. GPS recording and calculations don't depend on the map at all.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reporting an external system's failure
      setUnsupported(true);
      return;
    }
    onReady(controller);
    return () => {
      onReady(null);
      controller.destroy();
    };
  }, [onReady]);

  return (
    <div className="absolute inset-0 bg-[#E9F0EA]" data-testid="land-map">
      {/* MapLibre forces position: relative on this element, so it is sized explicitly. */}
      <div ref={containerRef} className="size-full" />
      {unsupported && (
        <p className="absolute inset-x-6 top-1/3 text-center text-sm text-muted">
          {t.map.unsupported}
        </p>
      )}
    </div>
  );
}
