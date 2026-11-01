"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AREA_UNIT_ORDER } from "@/config/units";
import { t } from "@/lib/i18n";
import { clearSession } from "@/lib/storage/measurementSession";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { measurementStore, useMeasurement } from "@/store/measurementStore";
import { ConfirmDialog } from "./ConfirmDialog";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const areaUnit = useMeasurement((state) => state.areaUnit);
  const [confirmingClear, setConfirmingClear] = useState(false);

  function handleClear() {
    clearSession();
    measurementStore.dispatch({ type: "RESET" });
    setConfirmingClear(false);
    onOpenChange(false);
    showToast({ message: t.settings.cleared, tone: "success" });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>{t.settings.title}</DialogTitle>

          <section className="mt-5">
            <h3 className="text-[15px] font-semibold" id="fm-unit-label">
              {t.settings.areaUnit}
            </h3>
            <div
              role="radiogroup"
              aria-labelledby="fm-unit-label"
              className="mt-2 grid grid-cols-2 gap-2"
            >
              {AREA_UNIT_ORDER.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  role="radio"
                  aria-checked={areaUnit === unit}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-sm font-medium transition-colors duration-150",
                    areaUnit === unit
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface text-foreground",
                  )}
                  onClick={() => measurementStore.dispatch({ type: "SET_AREA_UNIT", unit })}
                >
                  {t.units[unit].label}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h3 className="text-[15px] font-semibold">{t.settings.session}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t.settings.sessionWarning}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full text-danger"
              onClick={() => setConfirmingClear(true)}
            >
              {t.settings.clear}
            </Button>
          </section>

          <section className="mt-6">
            <h3 className="text-[15px] font-semibold">{t.settings.aboutTitle}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t.settings.about}</p>
          </section>

          <section className="mt-6">
            <h3 className="text-[15px] font-semibold">{t.settings.install}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t.settings.installAndroid}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t.settings.installIos}</p>
          </section>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmingClear}
        destructive
        title={t.settings.clearTitle}
        description={t.settings.clearBody}
        confirmLabel={t.settings.clear}
        cancelLabel={t.common.cancel}
        onConfirm={handleClear}
        onCancel={() => setConfirmingClear(false)}
      />
    </>
  );
}
