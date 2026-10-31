import { CreditCard, Fingerprint, Folder, KeyRound, NotebookText, Star, type LucideIcon } from "lucide-react";
import type { Category, EntryKind } from "@/types/vault";

export const ENTRY_KIND_META: Record<EntryKind, { label: string; icon: LucideIcon }> = {
  login: { label: "登录信息", icon: KeyRound },
  note: { label: "安全笔记", icon: NotebookText },
  card: { label: "银行卡", icon: CreditCard },
  identity: { label: "证件信息", icon: Fingerprint },
};

export const CATEGORIES: { id: Category; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "全部项目", icon: Folder },
  { id: "favorites", label: "收藏", icon: Star },
  ...Object.entries(ENTRY_KIND_META).map(([id, meta]) => ({ id: id as EntryKind, label: meta.label, icon: meta.icon })),
];
