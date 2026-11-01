"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function ErrorPage() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">{t.errorBoundary.title}</h1>
      <p className="max-w-sm text-muted">{t.errorBoundary.body}</p>
      <Button onClick={() => window.location.reload()}>{t.errorBoundary.reload}</Button>
    </main>
  );
}
