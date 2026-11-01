"use client";

import { Crosshair, Layers, Maximize, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { IconButton } from "@/components/common/IconButton";
import { t } from "@/lib/i18n";
import type { MapController } from "@/lib/map/mapController";
import { MAP_STYLE_OPTIONS } from "@/lib/map/mapStyles";
import { cn } from "@/lib/utils";
import { measurementStore, useMeasurement } from "@/store/measurementStore";

function ControlGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col rounded-2xl bg-surface shadow-control">{children}</div>;
}

export function MapControls({
  controller,
  className,
}: {
  controller: MapController | null;
  className?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mapStyle = useMeasurement((state) => state.mapStyle);
  const status = useMeasurement((state) => state.status);
  const showFit = status === "reviewing";

  return (
    <div className={cn("flex flex-col items-end gap-3", className)}>
      <div className="relative">
        <ControlGroup>
          <IconButton
            label={t.map.layers}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Layers className="size-5" aria-hidden />
          </IconButton>
        </ControlGroup>
        {menuOpen && (
          <div
            role="radiogroup"
            aria-label={t.map.layers}
            className="absolute top-0 right-14 w-56 rounded-2xl bg-surface p-1.5 shadow-panel"
          >
            {MAP_STYLE_OPTIONS.map(({ id }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={mapStyle === id}
                className={cn(
                  "flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium",
                  mapStyle === id ? "bg-primary-soft text-primary" : "text-foreground",
                )}
                onClick={() => {
                  measurementStore.dispatch({ type: "SET_MAP_STYLE", style: id });
                  setMenuOpen(false);
                }}
              >
                {t.map.styles[id]}
              </button>
            ))}
          </div>
        )}
      </div>

      <ControlGroup>
        {showFit ? (
          <IconButton label={t.map.fit} onClick={() => controller?.fitBoundary()}>
            <Maximize className="size-5" aria-hidden />
          </IconButton>
        ) : (
          <IconButton label={t.map.locate} onClick={() => controller?.locate()}>
            <Crosshair className="size-5" aria-hidden />
          </IconButton>
        )}
      </ControlGroup>

      <ControlGroup>
        <IconButton label={t.map.zoomIn} onClick={() => controller?.zoomIn()}>
          <Plus className="size-5" aria-hidden />
        </IconButton>
        <div className="mx-3 h-px bg-border" />
        <IconButton label={t.map.zoomOut} onClick={() => controller?.zoomOut()}>
          <Minus className="size-5" aria-hidden />
        </IconButton>
      </ControlGroup>
    </div>
  );
}
