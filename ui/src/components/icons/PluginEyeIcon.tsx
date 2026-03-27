import { cn } from "@/lib/utils"

type Props = {
  className?: string
  size?: number
  title?: string
}

/**
 * 眼睛(可见)：内联 SVG，避免 Figma 环境下外部 `icons.svg#symbol` 的 `<use>` 加载不到。
 */
export function PluginEyeIcon({ className, size = 16, title }: Props) {
  return (
    <svg
      className={cn("inline-block shrink-0 text-muted-foreground", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

