import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/" className="font-medium text-primary underline underline-offset-4">
        Back to FieldMeasure
      </Link>
    </main>
  );
}
