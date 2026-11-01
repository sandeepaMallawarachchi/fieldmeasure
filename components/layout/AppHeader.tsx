import { ChevronLeft, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/common/IconButton";
import { Logo } from "@/components/common/Logo";
import { t } from "@/lib/i18n";

export function AppHeader({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <header className="flex items-center justify-between bg-surface py-1 pr-2 pl-3 shadow-control md:rounded-b-3xl">
      <Logo />
      <IconButton label={t.header.settings} onClick={onOpenSettings}>
        <Settings className="size-6" aria-hidden />
      </IconButton>
    </header>
  );
}

export function SubHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-1 bg-surface py-2 pr-3 pl-1 shadow-control">
      <IconButton label={t.common.back} onClick={onBack}>
        <ChevronLeft className="size-6" aria-hidden />
      </IconButton>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      {action}
    </header>
  );
}
