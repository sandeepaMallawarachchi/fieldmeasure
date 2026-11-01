import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AppCredit({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "border-t border-border pt-3 text-center text-xs leading-relaxed text-muted",
        className,
      )}
    >
      <p>{t.settings.copyright}</p>
      <p>
        {t.settings.credit}{" "}
        <a
          href={t.settings.creditUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          {t.settings.creditName}
        </a>
      </p>
    </footer>
  );
}
