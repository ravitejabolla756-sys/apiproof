import React from "react";

export interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  variant?: "light" | "dark" | "auto";
}

/**
 * MY OWL Brand Logo Component
 * Renders the official MY OWL logo asset from /LOGO.jpeg (source: C:\YC\LOGO.jpeg).
 * Uses CSS brightness/invert filter for high contrast on dark surfaces while
 * preserving alpha transparency and subpixel anti-aliasing.
 */
export function MyOwlLogo({
  className = "h-5 w-auto",
  variant = "light",
  alt = "MY OWL Logo",
  ...props
}: LogoProps) {
  // 'light' variant inverts black pixels to crisp white for dark surfaces (navbar, footer, dark mode)
  // 'dark' variant keeps original black pixels for light surfaces (login page)
  const filterClass =
    variant === "light"
      ? "brightness-0 invert"
      : variant === "dark"
      ? ""
      : "dark:brightness-0 dark:invert";

  const { style, ...restProps } = props;

  return (
    <img
      src="/LOGO.jpeg"
      alt={alt}
      style={{ maxHeight: "100%", width: "auto", display: "inline-block", ...style }}
      className={`object-contain select-none shrink-0 ${filterClass} ${className}`}
      {...restProps}
    />
  );
}

export { MyOwlLogo as ApiProofLogo };
