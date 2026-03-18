import type { HTMLAttributes } from "react";
import styles from "./Card.module.css";

type CardProps = HTMLAttributes<HTMLDivElement>;

function joinClassNames(...names: Array<string | undefined>) {
  return names.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: CardProps) {
  return <div className={joinClassNames(styles.card, className)} {...props} />;
}

export function CardHeader({ className, ...props }: CardProps) {
  return <div className={joinClassNames(styles.header, className)} {...props} />;
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={joinClassNames(styles.content, className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardProps) {
  return <div className={joinClassNames(styles.footer, className)} {...props} />;
}
