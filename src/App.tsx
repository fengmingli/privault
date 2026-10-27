import { CreditCard, KeyRound, NotebookText } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { PrototypeBanner } from "@/components/PrototypeBanner";

const entryTypes = [
  { icon: KeyRound, title: "账号与密码", detail: "登录信息、自定义字段与密码历史" },
  { icon: NotebookText, title: "安全笔记", detail: "只保存在本机的私人文本" },
  { icon: CreditCard, title: "证件与银行卡", detail: "结构化整理重要隐私信息" },
];

function App() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <PrototypeBanner />
      <main className="flex flex-1 items-center justify-center px-8 py-12">
        <div className="grid w-full max-w-5xl items-center gap-16 lg:grid-cols-[1fr_400px]">
          <section className="space-y-7">
            <div className="flex items-center gap-3">
              <BrandMark />
              <span className="text-sm font-semibold tracking-wide text-foreground-muted">PRIVAULT</span>
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl font-semibold tracking-tight text-foreground">Privault</h1>
              <p className="max-w-md text-2xl font-medium leading-snug tracking-tight text-foreground">把重要信息，留在本机。</p>
              <p className="max-w-md text-base leading-7 text-foreground-muted">为 Mac 与 Windows 设计的完全离线个人保险库。无需账号，不依赖云服务。</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium text-foreground-muted">
              <span className="rounded-full border bg-surface px-3 py-1.5">完全离线设计</span>
              <span className="rounded-full border bg-surface px-3 py-1.5">Mac · Windows</span>
              <span className="rounded-full border bg-surface px-3 py-1.5">本地数据</span>
            </div>
          </section>

          <section aria-label="可保存的信息类型" className="rounded-xl border bg-surface p-6 shadow-panel">
            <div className="mb-6 space-y-1">
              <h2 className="text-lg font-semibold">一个安静、可靠的空间</h2>
              <p className="text-sm text-foreground-muted">集中整理只属于你的重要信息。</p>
            </div>
            <div className="space-y-5">
              {entryTypes.map(({ icon: Icon, title, detail }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-foreground-muted">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 border-t pt-4 text-xs leading-5 text-foreground-muted">当前为界面设计预览，安全核心尚未接入。</p>
          </section>
        </div>
      </main>
      <footer className="pb-5 text-center text-xs text-foreground-muted">Privault UI Prototype</footer>
    </div>
  );
}

export default App;
