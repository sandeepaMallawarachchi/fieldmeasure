"use client";

import { Check, Download, EllipsisVertical, Globe, Share, SquarePlus } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { t } from "@/lib/i18n";
import {
  dismissInstallGuide,
  getCurrentInstallPlatform,
  getInstallGuidePlatform,
  type InstallPlatform,
} from "@/lib/pwa/install";
import { useMeasurement } from "@/store/measurementStore";

/** Chrome's install event, which isn't part of the standard DOM types. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STEPS: Record<InstallPlatform, { icon: typeof Share; text: string }[]> = {
  ios: [
    { icon: Globe, text: t.install.ios[0] },
    { icon: Share, text: t.install.ios[1] },
    { icon: SquarePlus, text: t.install.ios[2] },
    { icon: Check, text: t.install.ios[3] },
  ],
  android: [
    { icon: Globe, text: t.install.android[0] },
    { icon: EllipsisVertical, text: t.install.android[1] },
    { icon: Download, text: t.install.android[2] },
  ],
};

const subscribeToNothing = () => () => undefined;

export function InstallGuideDialog({ blocked }: { blocked: boolean }) {
  // Device details only exist in the browser, so the server always renders nothing.
  const platform = useSyncExternalStore(subscribeToNothing, getInstallGuidePlatform, () => null);
  const [closed, setClosed] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  // Waits for the GPS question to be answered, so the two prompts don't compete,
  // and never interrupts a measurement that's already under way.
  const gpsSettled = useMeasurement(
    (state) =>
      state.status === "ready" ||
      state.status === "error" ||
      (state.status === "acquiring-gps" && state.currentFix !== null),
  );

  useEffect(() => {
    if (!getCurrentInstallPlatform()) return;
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault(); // Replaces Chrome's own banner with the button below.
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setClosed(true);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  function close() {
    dismissInstallGuide();
    setClosed(true);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    // The browser's event can only be used once, whichever choice was made.
    close();
  }

  // Once open it stays open until answered, even if GPS status changes behind it.
  const [hasOpened, setHasOpened] = useState(false);
  const shouldOpen = platform !== null && gpsSettled && !blocked && !closed;
  if (shouldOpen && !hasOpened) setHasOpened(true);

  if (!platform || closed || !hasOpened) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent data-testid="install-guide">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={64}
          height={64}
          unoptimized
          className="mb-3 rounded-2xl border border-border"
        />
        <DialogTitle>{t.install.title}</DialogTitle>
        <DialogDescription>{t.install.description}</DialogDescription>

        {installEvent ? (
          <Button className="mt-5 w-full" onClick={install}>
            <Download className="size-5" aria-hidden />
            {t.install.installNow}
          </Button>
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            {STEPS[platform].map(({ icon: Icon, text }, index) => (
              <li key={text} className="flex items-center gap-3 text-[15px] leading-snug">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="font-semibold">{index + 1}. </span>
                  {text}
                </span>
              </li>
            ))}
          </ol>
        )}

        <Button
          variant={installEvent ? "ghost" : "secondary"}
          size="md"
          className="mt-4 w-full"
          onClick={close}
        >
          {t.install.notNow}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
