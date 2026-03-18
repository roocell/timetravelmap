import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

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
        styles.button,
        variant === "ghost" && styles.ghost,
        size === "icon" && styles.iconOnly,
        className
      )}
      {...props}
    />
  );
}
