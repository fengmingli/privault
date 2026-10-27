import type { PropsWithChildren } from "react";
import { BrandMark } from "@/components/BrandMark";

export function AccessLayout({ children }: PropsWithChildren) {
  return (
    <main className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-10 lg:px-12">
      <div className="grid w-full max-w-5xl items-center gap-16 lg:grid-cols-[1fr_420px]">
        <section className="space-y-7">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-sm font-semibold tracking-wide text-foreground-muted">PRIVAULT</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-semibold tracking-tight">Privault</h1>
            <p className="max-w-md text-2xl font-medium leading-snug tracking-tight">把重要信息，留在本机。</p>
            <p className="max-w-md text-base leading-7 text-foreground-muted">为 Mac 与 Windows 设计的完全离线个人保险库。无需账号，不依赖云服务。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-medium text-foreground-muted">
            <span className="rounded-full border bg-surface px-3 py-1.5">完全离线设计</span>
            <span className="rounded-full border bg-surface px-3 py-1.5">Mac · Windows</span>
            <span className="rounded-full border bg-surface px-3 py-1.5">本地数据</span>
          </div>
        </section>
        <section className="w-full rounded-xl border bg-surface p-7 shadow-panel">{children}</section>
      </div>
    </main>
  );
}
