import styles from "./Icon.module.css";
import { type IconName, IconSet, type IconShape } from "./IconSet";

export interface IconProps {
  name: IconName;
  /** Width and height. Without it, 1.5rem. */
  size?: number | string;
  className?: string;
  /** Names the icon for screen readers. Without it the icon is decoration and is hidden from them. */
  label?: string;
}

function draw(shape: IconShape, index: number) {
  switch (shape.tag) {
    case "path":
      return <path key={index} d={shape.d} transform={shape.transform} />;
    case "circle":
      return <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} className={shape.solid ? styles.solid : undefined} />;
    case "rect":
      return <rect key={index} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />;
  }
}

/** An icon of the interface, in the colour of the text around it. */
export default function Icon({ name, size, className, label }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={[styles.icon, className].filter(Boolean).join(" ")}
      style={size === undefined ? undefined : { width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {IconSet.shapes(name).map(draw)}
    </svg>
  );
}
