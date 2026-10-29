export function PrototypeBanner({ realMode = false }: { realMode?: boolean }) {
  return (
    <div role="status" className="z-20 flex min-h-8 items-center justify-center border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-center text-xs font-medium text-foreground">
      {realMode ? "本地加密存储 · 验证中" : "UI 原型，请勿输入真实密码"}
    </div>
  );
}
