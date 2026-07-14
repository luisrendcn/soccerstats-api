import { useState } from "react";
import type React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  showLabel: string;
  hideLabel: string;
};

export function PasswordInput({
  className,
  showLabel,
  hideLabel,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? hideLabel : showLabel;
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={["pr-10", className].filter(Boolean).join(" ")}
      />
      <button
        type="button"
        aria-label={label}
        title={label}
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setVisible((current) => !current)}
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  );
}
