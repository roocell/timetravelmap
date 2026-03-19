import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost";
  size?: "default" | "icon";
};

function joinClassNames(...names: Array<string | undefined | false>) {
  return names.filter(Boolean).join(" ");
}

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={joinClassNames(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[rgba(21,49,63,0.12)] bg-[rgba(255,255,255,0.92)] px-[14px] py-[10px] text-[14px] font-bold leading-none text-[#15313f] shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-[background-color,border-color,transform] duration-150 hover:border-[rgba(21,49,63,0.2)] hover:bg-white active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(21,49,63,0.35)]",
        variant === "ghost" && "bg-[rgba(255,255,255,0.78)]",
        size === "icon" && "p-[10px]",
        className
      )}
      {...props}
    />
  );
}
