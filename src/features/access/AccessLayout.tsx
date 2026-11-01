import type { PropsWithChildren } from "react";
import { BrandMark } from "@/components/BrandMark";

type AccessLayoutProps = PropsWithChildren<{
  variant?: "split" | "focused";
}>;

function AccessBrand() {
  return (
    <div className="flex items-center gap-3">
      <BrandMark className="h-10 w-10 rounded-lg" />
      <span className="text-lg font-semibold tracking-tight">Privault</span>
    </div>
  );
}

function AccessCard({ children }: PropsWithChildren) {
  return <section className="w-full rounded-xl border bg-surface p-7 shadow-sm">{children}</section>;
}

export function AccessLayout({ children, variant = "split" }: AccessLayoutProps) {
  if (variant === "focused") {
    return (
      <main data-layout={variant} className="flex flex-1 overflow-y-auto px-6 py-8">
        <div className="m-auto w-full max-w-[420px] space-y-6">
          <AccessBrand />
          <AccessCard>{children}</AccessCard>
        </div>
      </main>
    );
  }

  return (
    <main data-layout={variant} className="flex flex-1 overflow-y-auto px-6 py-10 lg:px-12">
      <div className="m-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14">
        <section className="space-y-6">
          <AccessBrand />
          <div className="space-y-4">
            <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">把重要信息，留在本机。</h1>
            <p className="max-w-md text-base leading-7 text-foreground-muted">为 Mac 与 Windows 设计的完全离线个人保险库。无需账号，不依赖云服务。</p>
          </div>
        </section>
        <AccessCard>{children}</AccessCard>
      </div>
    </main>
  );
}
