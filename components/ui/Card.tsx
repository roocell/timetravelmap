import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

function joinClassNames(...names: Array<string | undefined>) {
  return names.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={joinClassNames(
        "overflow-hidden rounded-[24px] border border-[rgba(33,55,70,0.12)] bg-[rgba(250,252,253,0.95)] shadow-[0_24px_80px_rgba(31,52,65,0.18)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={joinClassNames(
        "flex items-end justify-between gap-6 px-8 pb-5 pt-7",
        className
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={joinClassNames("block", className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardProps) {
  return <div className={joinClassNames("block", className)} {...props} />;
}
