import * as React from "react"

import { cn } from "@/lib/utils"

export type PluginSpriteIconId = "plugin-info-icon" | "plugin-eye-icon" | "plugin-eye-off-icon"

type Props = {
  id: PluginSpriteIconId
  className?: string
  size?: number
  title?: string
}

/**
 * 使用 `ui/public/icons.svg` 中的 symbol。
 * - 开发：`/icons.svg#id`（Vite public）
 * - Figma 插件：`build:figma` 会把 `icons.svg` 复制到与 `ui-react.html` 同级，用相对路径 `./icons.svg#id`
 */
export function SpriteIcon({ id, className, size = 16, title }: Props) {
  const href = React.useMemo(() => {
    const base = import.meta.env.DEV ? "/icons.svg" : "./icons.svg"
    return `${base}#${id}`
  }, [id])

  return (
    <svg
      className={cn("inline-block shrink-0", className)}
      width={size}
      height={size}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <use href={href} />
    </svg>
  )
}
