import { useState, type ChangeEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  visibilityLabel: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function PasswordInput({ id, value, onChange, visibilityLabel, disabled = false, autoFocus = false }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={visible ? "text" : "password"} value={value} onChange={onChange} className="control pr-11" autoComplete="off" autoFocus={autoFocus} disabled={disabled} />
      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8" aria-label={`${visible ? "隐藏" : "显示"}${visibilityLabel}`} disabled={disabled} onClick={() => setVisible((current) => !current)}>
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </Button>
    </div>
  );
}
