import type { ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";

import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "danger";

function classes(variant: ButtonVariant, extra?: string): string {
  return [styles.button, styles[variant], extra].filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** A button. `primary` for the main action of a page, `danger` for a destructive one. */
export default function Button({ variant = "primary", className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={classes(variant, className)} {...rest} />;
}

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
}

/** A link to another page of the application, drawn as a button. */
export function ButtonLink({ variant = "primary", className, ...rest }: ButtonLinkProps) {
  return <Link className={classes(variant, className)} {...rest} />;
}
