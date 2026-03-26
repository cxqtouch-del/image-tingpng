import * as React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PluginInfoIcon } from "@/components/icons/PluginInfoIcon"
import { SpriteIcon } from "@/components/icons/SpriteIcon"
import { cn } from "@/lib/utils"

import type { ZipFile } from "./export/zip"
import { buildZip } from "./export/zip"
import { tinifyCompress } from "./export/tinypng"
import { verifyApiKeyBeforeSave } from "./keyVerify"

type PluginLayerNode = {
  id: string
  name: string
  width: number
  height: number
  thumbnail?: Uint8Array | null
}

type PluginMessage =
  | { type: "load-settings"; apiKey: string; hasShownInfoModal: boolean; compressionCount: number | null }
  | { type: "api-key-saved"; apiKey: string }
  | { type: "compression-count-updated"; count: number | null }
  | { type: "selection-change"; nodes: PluginLayerNode[]; totalSelectedCount: number }
  | { type: "export-complete-data"; filename: string; bytes: number[] | Uint8Array }
  | { type: "export-all-complete"; total: number }
  | { type: "error"; message: string }

const MAX_EXPORT_ITEMS = 5

const T = {
  zh: {
    exportContent: "导出内容",
    selectAll: "全选",
    clear: "清空",
    noSelection: "单次导出上限为 5 个",
    exportSize: "导出尺寸",
    selectSizeError: "请选择一个导出尺寸",
    exportFormat: "导出格式",
    packageDownload: "打包下载",
    manageKey: "管理 Key",
    exportBtn: "导出",
    exportBtnCount: "导出 {{n}} 个内容",
    modalTitle: "设置 TinyPNG API Key",
    currentKey: "当前 Key:",
    usedCount: "已使用 {{n}} / 500 次",
    enterKeyPlaceholder: "输入 API Key",
    cancel: "取消",
    save: "保存",
    cannotExport: "无法导出",
    keyLimitReached: "Key 使用次数已达到 500 次限制",
    gotIt: "知道了",
    howToGetKey: "如何获取 API Key？",
    iGotIt: "我知道了",
    infoStep1:
      '1. 访问 <a href="https://tinypng.com/" target="_blank" style="color: var(--blue); text-decoration: none;">tinypng.com</a> 官网。',
    infoStep2: "2. 输入你的名字和邮箱。",
    infoStep3:
      "3. 去邮箱查收登录链接，进入后台控制台（Dashboard）。你将看到一串类似于 yX9kzS1m... 的字符，这就是你的 API Key。",
    infoNote: "注意：免费账户每个月有 500 张图片的免费额度。",
    activated: "激活成功！",
    notSet: "未设置",
    exportSuccess: "导出成功！",
    compressingToast: "压缩导出中<br>请耐心等待",
    exportingToast: "导出中...",
    maxExportToast: "最多可一次导出5个内容",
    zipTooltip: "由于文件较多<br>打包后一键下载",
    compressFailed: "压缩失败",
    unknownError: "未知错误",
    saveSuccess: "保存成功",
    tinypngNoReduce: "提示：TinyPNG 未能进一步压缩此图片",
    orig: "原",
    new: "新",
    enterValidKey: "请输入有效的 API Key",
    invalidKeyFormat: "Key 格式不正确，请检查后重试",
    keyVerifyFailed: "Key 校验失败，请稍后重试",
    keyInvalid: "API Key 无效，请确认后重试",
    keyVerifyNetworkError: "网络异常，暂时无法校验 Key",
    browserBlockHint:
      '提示：浏览器可能拦截多文件下载。若仅下载了一个文件，请在浏览器站点设置中允许"自动下载多个文件"，或使用"打包下载"。',
  },
  en: {
    exportContent: "Export",
    selectAll: "Select all",
    clear: "Clear",
    noSelection: "Max 5 items per export",
    exportSize: "Export size",
    selectSizeError: "Please select an export size",
    exportFormat: "Export format",
    packageDownload: "Package download",
    manageKey: "Manage Key",
    exportBtn: "Export",
    exportBtnCount: "Export {{n}} items",
    modalTitle: "Set TinyPNG API Key",
    currentKey: "Current Key:",
    usedCount: "Used {{n}} / 500",
    enterKeyPlaceholder: "Enter API Key",
    cancel: "Cancel",
    save: "Save",
    cannotExport: "Cannot export",
    keyLimitReached: "Key usage has reached the 500 limit",
    gotIt: "Got it",
    howToGetKey: "How to get API Key?",
    iGotIt: "I got it",
    infoStep1:
      '1. Visit <a href="https://tinypng.com/" target="_blank" style="color: var(--blue); text-decoration: none;">tinypng.com</a>.',
    infoStep2: "2. Enter your name and email.",
    infoStep3:
      "3. Check your email for the login link, go to Dashboard. You will see a string like yX9kzS1m..., that is your API Key.",
    infoNote: "Note: Free accounts get 500 images per month.",
    activated: "Activated!",
    notSet: "Not set",
    exportSuccess: "Export complete!",
    compressingToast: "Compressing...<br>Please wait",
    exportingToast: "Exporting...",
    maxExportToast: "Max 5 items per export",
    zipTooltip: "Multiple files.<br>Package for one-click download",
    compressFailed: "Compression failed",
    unknownError: "Unknown error",
    saveSuccess: "Saved successfully",
    tinypngNoReduce: "TinyPNG could not reduce this image",
    orig: "orig",
    new: "new",
    enterValidKey: "Please enter a valid API Key",
    invalidKeyFormat: "Invalid key format. Please check and try again.",
    keyVerifyFailed: "Key verification failed. Please try again.",
    keyInvalid: "Invalid API Key. Please verify and try again.",
    keyVerifyNetworkError: "Network error. Unable to verify key right now.",
    browserBlockHint:
      'Tip: Browser may block multiple downloads. If only one file downloaded, allow "Automatically download multiple files" in site settings, or use "Package download".',
  },
} as const

function t(currentLang: "zh" | "en", key: keyof typeof T["zh"], params?: Record<string, string | number>) {
  const base = (T as any)[currentLang]?.[key] ?? (T as any).zh[key] ?? String(key)
  if (!params) return base
  let s = base as string
  for (const k of Object.keys(params)) {
    s = s.replace(`{{${k}}}`, String(params[k]))
  }
  return s
}

export default function PluginUI() {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [currentLang, setCurrentLang] = React.useState<"zh" | "en">("zh")

  // UI state
  const [candidateNodes, setCandidateNodes] = React.useState<PluginLayerNode[]>([])
  const [selectedNodeIds, setSelectedNodeIds] = React.useState<Set<string>>(() => new Set())
  const [selectedNodeIdsOrder, setSelectedNodeIdsOrder] = React.useState<string[]>([])
  const [isManuallyCleared, setIsManuallyCleared] = React.useState(false)

  const [selectedScales, setSelectedScales] = React.useState<number[]>([2])
  const [selectedFormat, setSelectedFormat] = React.useState<"PNG" | "JPG" | "SVG">("PNG")
  const canUseCloudCompress = selectedFormat === "PNG" || selectedFormat === "JPG"

  const [isZipDownload, setIsZipDownload] = React.useState(false)
  const [isCloudCompress, setIsCloudCompress] = React.useState(false)

  const [storedApiKey, setStoredApiKey] = React.useState("")
  const [hasShownInfoModal, setHasShownInfoModal] = React.useState(false)
  const [savedCompressionCount, setSavedCompressionCount] = React.useState<number | null>(null)

  // Modals
  const [apiKeyModalOpen, setApiKeyModalOpen] = React.useState(false)
  const [keyLimitModalOpen, setKeyLimitModalOpen] = React.useState(false)
  const [infoModalOpen, setInfoModalOpen] = React.useState(false)

  // API key input validation UI
  const [modalKeyValue, setModalKeyValue] = React.useState("")
  const [modalKeyError, setModalKeyError] = React.useState("")
  const [isSavingKey, setIsSavingKey] = React.useState(false)
  const [isPassword, setIsPassword] = React.useState(true)

  // Bottom message/toast
  const [toastHtml, setToastHtml] = React.useState<string>("")
  const [toastVisible, setToastVisible] = React.useState(false)
  const toastTimeoutRef = React.useRef<number | null>(null)

  const [messageText, setMessageText] = React.useState("")
  const [messageType, setMessageType] = React.useState<"info" | "error">("info")

  const selectedLayerCount = selectedNodeIdsOrder.length

  const selectAllDisabled = isManuallyCleared || candidateNodes.length === 0
  const exportDisabled = selectedLayerCount === 0 || selectedScales.length === 0

  // Thumbnail URLs for candidate nodes
  const [thumbUrls, setThumbUrls] = React.useState<Record<string, string>>({})
  React.useEffect(() => {
    Object.values(thumbUrls).forEach((url) => URL.revokeObjectURL(url))
    const next: Record<string, string> = {}
    for (const n of candidateNodes) {
      if (n.thumbnail) {
        const blob = new Blob([n.thumbnail as any], { type: "image/png" })
        next[n.id] = URL.createObjectURL(blob)
      }
    }
    setThumbUrls(next)
    return () => {
      Object.values(next).forEach((url) => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateNodes])

  const requestResize = React.useCallback(() => {
    const desired = Math.ceil(containerRef.current?.getBoundingClientRect().height ?? 0)
    window.parent.postMessage({ pluginMessage: { type: "resize", height: desired } }, "*")
  }, [])

  const requestResizeAfterDom = React.useCallback(() => {
    requestAnimationFrame(() => {
      requestResize()
      requestAnimationFrame(() => requestResize())
    })
  }, [requestResize])

  // ResizeObserver兜底
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => requestResize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [requestResize])

  // Language init
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("plugin-lang")
      if (saved === "en" || saved === "zh") setCurrentLang(saved)
    } catch {}
  }, [])

  React.useEffect(() => {
    // Ensure height correct after language switch (reflow)
    requestResize()
    requestAnimationFrame(() => requestResize())
  }, [currentLang, requestResize])

  React.useEffect(() => {
    // Notify plugin main thread that UI is ready
    window.parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*")
  }, [])

  // Over limit freeze logic state
  const lastFigmaSelectedCountRef = React.useRef(0)
  const isOverLimitFrozenRef = React.useRef(false)
  const frozenCandidateNodesRef = React.useRef<PluginLayerNode[]>([])

  const showToast = React.useCallback((html: string, durationMs = 2000) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
    setToastHtml(html)
    setToastVisible(true)
    if (durationMs > 0) {
      toastTimeoutRef.current = window.setTimeout(() => {
        setToastVisible(false)
      }, durationMs)
    }
  }, [])

  const hideToast = React.useCallback(() => {
    setToastVisible(false)
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
  }, [])

  const showMessage = React.useCallback((text: string, type: "info" | "error" = "info") => {
    setMessageText(text || "")
    setMessageType(type)
  }, [])

  // Candidate nodes displayed in UI (manual clear hides list)
  const renderedNodes = isManuallyCleared ? [] : candidateNodes

  // Select all / clear handlers
  const handleSelectAll = React.useCallback(() => {
    if (selectAllDisabled) return
    setIsManuallyCleared(false)
    const ids = candidateNodes.map((n) => n.id)
    const newSet = new Set(ids)
    setSelectedNodeIds(newSet)
    setSelectedNodeIdsOrder(ids)
    requestResizeAfterDom()
  }, [candidateNodes, selectAllDisabled, requestResizeAfterDom])

  const handleClearAll = React.useCallback(() => {
    setSelectedNodeIds(new Set())
    setSelectedNodeIdsOrder([])
    setIsManuallyCleared(true)
    showMessage("", "info")
    requestResizeAfterDom()
  }, [showMessage, requestResizeAfterDom])

  // Scale checkbox change
  const toggleScale = React.useCallback((scale: number, checked: boolean) => {
    setSelectedScales((prev) => {
      if (checked) {
        if (prev.includes(scale)) return prev
        return [...prev, scale]
      }
      return prev.filter((s) => s !== scale)
    })
    requestResizeAfterDom()
  }, [requestResizeAfterDom])

  // Update zip enforcement (like original: force zip when count > 1 or multiple scales)
  React.useEffect(() => {
    const shouldForceZip = selectedNodeIds.size > 1 || selectedScales.length > 1
    setIsZipDownload(shouldForceZip)
  }, [selectedNodeIds, selectedScales.length])

  // Format change
  React.useEffect(() => {
    if (!canUseCloudCompress && isCloudCompress) setIsCloudCompress(false)
  }, [canUseCloudCompress, isCloudCompress])

  // Selection-change handler from main
  React.useEffect(() => {
    function onMessage(event: MessageEvent) {
      const pluginMessage = (event.data as any)?.pluginMessage as PluginMessage | undefined
      if (!pluginMessage) return

      if (pluginMessage.type === "load-settings") {
        setStoredApiKey(pluginMessage.apiKey || "")
        setHasShownInfoModal(!!pluginMessage.hasShownInfoModal)
        setSavedCompressionCount(pluginMessage.compressionCount ?? null)
        if (pluginMessage.apiKey) setIsCloudCompress(true)
      } else if (pluginMessage.type === "api-key-saved") {
        setStoredApiKey(pluginMessage.apiKey)
      } else if (pluginMessage.type === "compression-count-updated") {
        setSavedCompressionCount(pluginMessage.count ?? null)
      } else if (pluginMessage.type === "selection-change") {
        const incomingNodes = pluginMessage.nodes || []
        const incomingCount =
          typeof (pluginMessage as any).totalSelectedCount === "number"
            ? (pluginMessage as any).totalSelectedCount
            : incomingNodes.length

        const MAX = MAX_EXPORT_ITEMS
        const overLimit = incomingCount > MAX
        if (overLimit && lastFigmaSelectedCountRef.current <= MAX) {
          showToast(t(currentLang, "maxExportToast") as string, 2500)
        }
        lastFigmaSelectedCountRef.current = incomingCount

        const fallbackCandidateNodes = incomingNodes.slice(0, MAX)
        const prevCandidateNodes = candidateNodes.slice()

        if (overLimit) {
          if (!isOverLimitFrozenRef.current) {
            isOverLimitFrozenRef.current = true
            frozenCandidateNodesRef.current =
              prevCandidateNodes.length > 0 ? prevCandidateNodes.slice() : fallbackCandidateNodes.slice()
          }
        } else {
          isOverLimitFrozenRef.current = false
          frozenCandidateNodesRef.current = []
        }

        const nextCandidateNodes = overLimit
          ? frozenCandidateNodesRef.current
          : fallbackCandidateNodes

        setCandidateNodes(nextCandidateNodes)
        setIsManuallyCleared(false) // new selection arrived, restore list

        const newIds = nextCandidateNodes.map((n) => n.id)
        const newSet = new Set(newIds)
        const oldSet = new Set(selectedNodeIds)

        if (nextCandidateNodes.length === 0) {
          setSelectedNodeIds(new Set())
          setSelectedNodeIdsOrder([])
          showMessage("", "info")
          requestResizeAfterDom()
          return
        }

        if (overLimit) {
          // Only init selected when empty
          if (selectedNodeIdsOrder.length === 0) {
            const set = new Set<string>()
            const order: string[] = []
            for (const id of newIds) {
              set.add(id)
              order.push(id)
            }
            setSelectedNodeIds(set)
            setSelectedNodeIdsOrder(order)
          }
        } else {
          const filteredOrder = selectedNodeIdsOrder.filter((id) => newSet.has(id))
          const newOrder = [...filteredOrder]
          newIds.forEach((id) => {
            if (!oldSet.has(id)) newOrder.push(id)
          })
          setSelectedNodeIds(new Set(newIds))
          setSelectedNodeIdsOrder(newOrder)
        }

        requestResizeAfterDom()
      } else if (pluginMessage.type === "export-complete-data") {
        // Will be handled by export session ref
        handleExportCompleteData(pluginMessage.filename, pluginMessage.bytes)
      } else if (pluginMessage.type === "export-all-complete") {
        handleExportAllComplete()
      } else if (pluginMessage.type === "error") {
        showMessage(pluginMessage.message, "error")
        setExportInProgress(false)
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentLang,
    candidateNodes,
    selectedNodeIds,
    selectedNodeIdsOrder.length,
    selectedScales.length,
  ])

  // Export pipeline refs
  const [exportInProgress, setExportInProgress] = React.useState(false)
  const [pendingAction, setPendingAction] = React.useState<null | "toggleCheckbox" | "openManageKey">(null)
  const exportSessionRef = React.useRef<{
    exportedFiles: ZipFile[]
    downloadQueue: Array<{ filename: string; bytes: Uint8Array }>
    downloading: boolean
    allComplete: boolean
    compressQueue: Array<{ filename: string; bytes: Uint8Array; apiKey: string }>
    activeCompressors: number
    pendingRecompress: number
    finalizeAfterRecompress: boolean
    isZipDownload: boolean
    isCloudCompress: boolean
    apiKey: string
    selectedFormat: "PNG" | "JPG" | "SVG"
    cancelled: boolean
  } | null>(null)

  const processNextDownload = React.useCallback(function processNextDownload(
    session: NonNullable<typeof exportSessionRef.current>
  ) {
    if (session.downloadQueue.length === 0) {
      session.downloading = false
      if (session.allComplete && !session.isZipDownload) {
        session.allComplete = false
        setExportInProgress(false)
        showToast(t(currentLang, "exportSuccess") as string)
      }
      return
    }

    session.downloading = true
    const { filename, bytes } = session.downloadQueue.shift()!
    const blob = new Blob([bytes.buffer as any], { type: "application/octet-stream" })
    const a = document.createElement("a")
    const url = URL.createObjectURL(blob)
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => {
      URL.revokeObjectURL(url)
      setTimeout(() => processNextDownload(session), 500)
    }, 200)
  }, [currentLang, showToast])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleExportCompleteData = React.useCallback((filename: string, bytes: any) => {
    const session = exportSessionRef.current
    if (!session || session.cancelled) return
    const u8 =
      bytes instanceof Uint8Array ? new Uint8Array(bytes as any) : new Uint8Array(bytes as number[])

    if (session.selectedFormat === "PNG" || session.selectedFormat === "JPG") {
      if (session.isCloudCompress && session.apiKey) {
        session.pendingRecompress++
        session.compressQueue.push({ filename, bytes: u8, apiKey: session.apiKey })
        const MAX_CONCURRENT_COMPRESS_TASKS = 3
        const scheduleCompressQueue = () => {
          while (session.activeCompressors < MAX_CONCURRENT_COMPRESS_TASKS && session.compressQueue.length > 0) {
            const task = session.compressQueue.shift()!
            session.activeCompressors++
            ;(async () => {
              let newBytes = task.bytes
              try {
                const res = await tinifyCompress(task.bytes, task.apiKey)
                newBytes = res.compressedBytes
                if (res.compressionCount != null) {
                  setSavedCompressionCount(res.compressionCount)
                  window.parent.postMessage({ pluginMessage: { type: "save-compression-count", count: res.compressionCount } }, "*")
                }
              } catch (e: any) {
                if (e?.isKeyLimit) {
                  setSavedCompressionCount(500)
                  window.parent.postMessage({ pluginMessage: { type: "save-compression-count", count: 500 } }, "*")
                  hideToast()
                  setKeyLimitModalOpen(true)
                  // Key limit reached: fall back to original bytes
                  // (keep flow consistent: decrement counters, finish export)
                } else {
                  showMessage(
                    `${t(currentLang, "compressFailed")}：${e?.message || t(currentLang, "unknownError")}`,
                    "error"
                  )
                }
              }

              if (session.isZipDownload) {
                session.exportedFiles.push({ filename, bytes: newBytes })
              } else {
                session.downloadQueue.push({ filename, bytes: newBytes })
                if (!session.downloading) processNextDownload(session)
              }

              session.pendingRecompress--
              session.activeCompressors--
              if (session.finalizeAfterRecompress && session.pendingRecompress === 0) {
                session.finalizeAfterRecompress = false
                finalizeAfterTinyPNG(session)
              }
              scheduleCompressQueue()
            })()
          }
        }

        scheduleCompressQueue()
      } else {
        // export without compression
        if (session.isZipDownload) session.exportedFiles.push({ filename, bytes: u8 })
        else {
          session.downloadQueue.push({ filename, bytes: u8 })
          if (!session.downloading) processNextDownload(session)
        }
      }
    } else {
      // SVG export: only export and download
      if (session.isZipDownload) session.exportedFiles.push({ filename, bytes: u8 })
      else {
        session.downloadQueue.push({ filename, bytes: u8 })
        if (!session.downloading) processNextDownload(session)
      }
    }
  }, [currentLang, hideToast, processNextDownload, showMessage])

  const finalizeAfterTinyPNG = React.useCallback((session: NonNullable<typeof exportSessionRef.current>) => {
    if (session.cancelled) return
    if (session.isZipDownload) {
      const blob = buildZip(session.exportedFiles)
      const a = document.createElement("a")
      const url = URL.createObjectURL(blob)
      a.href = url
      a.download = "export.zip"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportInProgress(false)
      showToast(t(currentLang, "exportSuccess") as string)
    } else if (session.downloadQueue.length === 0) {
      setExportInProgress(false)
      showToast(t(currentLang, "exportSuccess") as string)
    }
  }, [currentLang, showToast])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleExportAllComplete = React.useCallback(() => {
    const session = exportSessionRef.current
    if (!session || session.cancelled) return
    if (session.pendingRecompress > 0) {
      session.finalizeAfterRecompress = true
      return
    }
    if (session.isZipDownload) {
      const blob = buildZip(session.exportedFiles)
      const a = document.createElement("a")
      const url = URL.createObjectURL(blob)
      a.href = url
      a.download = "export.zip"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportInProgress(false)
      showToast(t(currentLang, "exportSuccess") as string)
    } else {
      session.allComplete = true
      if (session.downloadQueue.length === 0) {
        session.allComplete = false
        setExportInProgress(false)
        showToast(t(currentLang, "exportSuccess") as string)
      }
    }
  }, [currentLang, showToast])

  const handleExportClick = React.useCallback(() => {
    if (exportDisabled) return
    if (isCloudCompress && storedApiKey && savedCompressionCount != null && savedCompressionCount >= 500) {
      setKeyLimitModalOpen(true)
      return
    }

    const session = {
      exportedFiles: [] as ZipFile[],
      downloadQueue: [] as Array<{ filename: string; bytes: Uint8Array }>,
      downloading: false,
      allComplete: false,
      compressQueue: [] as Array<{ filename: string; bytes: Uint8Array; apiKey: string }>,
      activeCompressors: 0,
      pendingRecompress: 0,
      finalizeAfterRecompress: false,
      isZipDownload,
      isCloudCompress,
      apiKey: storedApiKey,
      selectedFormat,
      cancelled: false,
    }

    exportSessionRef.current = session

    setExportInProgress(true)
    showMessage("", "info")
    const toastMsg = isCloudCompress ? t(currentLang, "compressingToast") : t(currentLang, "exportingToast")
    showToast(toastMsg as string, 0)

    // Trigger export in main thread; UI will handle download/compress after export-complete-data arrives.
    const ids = selectedNodeIdsOrder
    window.parent.postMessage(
      {
        pluginMessage: {
          type: "export-image",
          settings: {
            nodeIds: ids,
            scales: selectedScales,
            format: selectedFormat,
            compress: false,
          },
        },
      },
      "*"
    )
  }, [
    exportDisabled,
    isCloudCompress,
    savedCompressionCount,
    storedApiKey,
    currentLang,
    isZipDownload,
    selectedFormat,
    selectedNodeIdsOrder,
    selectedScales,
    showMessage,
    showToast,
  ])

  // Key verification + save
  const isLikelyValidApiKeyFormat = React.useCallback((key: string) => {
    return !!key && key.length >= 8 && !/\s/.test(key) && /^[\x21-\x7E]+$/.test(key)
  }, [])

  const openManageKeyModal = React.useCallback(() => {
    setModalKeyValue(storedApiKey || "")
    setModalKeyError("")
    setIsPassword(true)
    setApiKeyModalOpen(true)
  }, [storedApiKey])

  const handleSaveKey = React.useCallback(async () => {
    if (isSavingKey) return
    const key = modalKeyValue.trim()
    setModalKeyError("")
    if (!key) {
      setModalKeyError(t(currentLang, "enterValidKey") as string)
      return
    }
    if (!isLikelyValidApiKeyFormat(key)) {
      setModalKeyError(t(currentLang, "invalidKeyFormat") as string)
      return
    }

    try {
      setIsSavingKey(true)
      const original = "..."
      void original
      const check = await verifyApiKeyBeforeSave(key)
      if (!check.ok) {
        if (check.reason === "invalid") setModalKeyError(t(currentLang, "keyInvalid") as string)
        else if (check.reason === "network") setModalKeyError(t(currentLang, "keyVerifyNetworkError") as string)
        else setModalKeyError(t(currentLang, "keyVerifyFailed") as string)
        return
      }

      setStoredApiKey(key)
      window.parent.postMessage({ pluginMessage: { type: "save-api-key", apiKey: key } }, "*")
      setApiKeyModalOpen(false)
      setIsCloudCompress(true)
      showToast(t(currentLang, "saveSuccess") as string)
    } finally {
      setIsSavingKey(false)
    }
  }, [
    currentLang,
    isLikelyValidApiKeyFormat,
    isSavingKey,
    modalKeyValue,
    showToast,
  ])

  const sortedRenderedNodes = React.useMemo(() => {
    const orderIndex = new Map(selectedNodeIdsOrder.map((id, idx) => [id, idx]))
    const originalIndex = new Map(renderedNodes.map((n, idx) => [n.id, idx]))
    const INF = 1e9
    return renderedNodes
      .slice()
      .sort((a, b) => {
        const ai = orderIndex.has(a.id) ? (orderIndex.get(a.id) as number) : INF
        const bi = orderIndex.has(b.id) ? (orderIndex.get(b.id) as number) : INF
        if (ai !== bi) return ai - bi
        return (originalIndex.get(a.id) ?? INF) - (originalIndex.get(b.id) ?? INF)
      })
  }, [renderedNodes, selectedNodeIdsOrder])

  const onToggleLayer = React.useCallback(
    (id: string, checked: boolean) => {
      if (checked) {
        if (!selectedNodeIds.has(id)) {
          if (selectedNodeIds.size >= MAX_EXPORT_ITEMS) {
            showToast(t(currentLang, "maxExportToast") as string, 2500)
            return
          }
          const nextSet = new Set(selectedNodeIds)
          nextSet.add(id)
          setSelectedNodeIds(nextSet)
          setSelectedNodeIdsOrder((prev) => (prev.includes(id) ? prev : [...prev, id]))
        }
      } else {
        if (selectedNodeIds.has(id)) {
          const nextSet = new Set(selectedNodeIds)
          nextSet.delete(id)
          setSelectedNodeIds(nextSet)
          setSelectedNodeIdsOrder((prev) => prev.filter((x) => x !== id))
        }
      }
    },
    [currentLang, selectedNodeIds, showToast]
  )

  return (
    <div
      ref={containerRef}
      className="w-[300px] bg-background text-foreground"
    >
      <div className="p-4 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium text-[#222]">
              <span>{t(currentLang, "exportContent")}</span> ({selectedLayerCount})
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  id="selectAllLayers"
                  onClick={handleSelectAll}
                  disabled={selectAllDisabled}
                  className={cn(
                    "text-[13px] font-normal text-[#2E3BF8] select-none",
                    selectAllDisabled && "text-muted-foreground cursor-default pointer-events-none"
                  )}
                >
                  {t(currentLang, "selectAll")}
                </button>
                <button
                  id="clearAllLayers"
                  onClick={handleClearAll}
                  className="text-[13px] font-normal text-[#ff4d4f] select-none"
                >
                  {t(currentLang, "clear")}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = currentLang === "zh" ? "en" : "zh"
                  setCurrentLang(next)
                  try {
                    localStorage.setItem("plugin-lang", next)
                  } catch {}
                }}
                className="h-auto px-[4px] py-[2px] text-[11px] border border-[#E5E5E5] rounded-[8px]"
              >
                中/EN
              </Button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto flex flex-col gap-2">
          {renderedNodes.length === 0 ? (
            <div
              id="noSelectionMessage"
              className="w-full shrink-0 text-center text-[13px] text-muted-foreground pt-5 pb-2"
            >
              {t(currentLang, "noSelection")}
            </div>
          ) : (
            sortedRenderedNodes.map((node) => {
              const checked = selectedNodeIds.has(node.id)
              const thumbUrl = thumbUrls[node.id]
              return (
                <div key={node.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => onToggleLayer(node.id, v === true)}
                  />
                  <div className="w-12 h-12 rounded-[6px] bg-[#e0e0e0] overflow-hidden">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={node.name} className="w-full h-full object-contain" />
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 flex-1 overflow-hidden">
                    <div className="text-[13px] font-normal text-[#222] truncate">{node.name}</div>
                    <div className="text-[12px] text-muted-foreground">{node.width} × {node.height}</div>
                  </div>
                </div>
              )
            })
          )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-[13px] font-medium text-[#222]">{t(currentLang, "exportSize")}</div>
          <div className="flex flex-col gap-1">
            <div id="scaleOptions" className="flex gap-[16px]">
              {[1, 2, 3, 4].map((s) => (
                <label key={s} className="flex items-center gap-[6px] text-[13px] text-[#222]">
                  <Checkbox
                    checked={selectedScales.includes(s)}
                    onCheckedChange={(v) => toggleScale(s, v === true)}
                  />
                  <span className="text-[13px]">{s}x</span>
                </label>
              ))}
            </div>
            <div className="text-[13px] leading-tight text-[#ff4d4f]">
              {selectedNodeIds.size > 0 && selectedScales.length === 0 ? t(currentLang, "selectSizeError") : ""}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="text-[13px] font-medium text-[#222]">{t(currentLang, "exportFormat")}</div>
            <Tabs
              value={selectedFormat}
              onValueChange={(v) => {
                setSelectedFormat(v as any)
                requestResizeAfterDom()
              }}
            >
              <TabsList>
                <TabsTrigger value="PNG" className="flex-1 px-0">
                  PNG
                </TabsTrigger>
                <TabsTrigger value="JPG" className="flex-1 px-0">
                  JPG
                </TabsTrigger>
                <TabsTrigger value="SVG" className="flex-1 px-0">
                  SVG
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[13px] text-[#222]">
                  <Checkbox checked={isZipDownload} onCheckedChange={(v) => setIsZipDownload(v === true)} />
                  <span>{t(currentLang, "packageDownload")}</span>
                </label>
              </div>

              {canUseCloudCompress ? (
                <label className="flex items-center text-[13px] text-[#222]">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={isCloudCompress}
                      onCheckedChange={(v) => {
                        if (v === true) {
                          if (!storedApiKey) {
                            if (!hasShownInfoModal) {
                              setPendingAction("toggleCheckbox")
                              setInfoModalOpen(true)
                              return
                            }
                            openManageKeyModal()
                            return
                          }
                          setIsCloudCompress(true)
                          return
                        }
                        setIsCloudCompress(false)
                      }}
                    />
                    <span>TinyPNG</span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center p-0.5 ml-[2px] shrink-0"
                    onClick={() => setInfoModalOpen(true)}
                    aria-label={currentLang === "zh" ? "说明" : "Info"}
                  >
                    <PluginInfoIcon size={16} />
                  </button>
                  <button
                    type="button"
                    className="ml-3 shrink-0 text-[#2E3BF8]"
                    onClick={() => {
                      if (!hasShownInfoModal) {
                        setPendingAction("openManageKey")
                        setInfoModalOpen(true)
                        return
                      }
                      openManageKeyModal()
                    }}
                  >
                    {t(currentLang, "manageKey")}
                  </button>
                </label>
              ) : null}
            </div>

            <Button
              id="exportButton"
              onClick={handleExportClick}
              disabled={exportDisabled || exportInProgress}
              className="w-full h-[44px] rounded-md text-[14px] font-medium"
            >
              {selectedLayerCount === 0
                ? t(currentLang, "exportBtn")
                : t(currentLang, "exportBtnCount", { n: selectedLayerCount })}
            </Button>
          </div>
        </div>

        <p
          id="message"
          className={cn(
            "text-[13px] mt-1",
            messageText ? "" : "hidden",
            messageType === "error" ? "text-[#ff4d4f]" : "text-blue-600"
          )}
        >
          {messageText}
        </p>
      </div>

      {toastVisible ? (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-6 py-3 rounded-md text-[14px] z-[2000] pointer-events-none whitespace-nowrap text-center max-w-[min(100%,90vw)]"
          dangerouslySetInnerHTML={{ __html: toastHtml }}
        />
      ) : null}

      {/* API Key Modal */}
      <Dialog open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen}>
        <DialogOverlay />
        <DialogContent className="w-[260px] p-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t(currentLang, "modalTitle")}</DialogTitle>
          </DialogHeader>
          <div className="text-[13px] text-muted-foreground leading-5 mb-3">
            <div id="currentKeyContainer" className="mb-2">
              {t(currentLang, "currentKey")}{" "}
              <span style={{ color: "#222", fontFamily: "monospace" }}>
                {storedApiKey || t(currentLang, "notSet")}
              </span>
            </div>
            <div id="compressionCountContainer" className="mt-2">
              {t(currentLang, "usedCount", { n: savedCompressionCount ?? "--" })}
            </div>
            <div className="mt-3">
              <div className="relative">
                <Input
                  id="modalKeyInput"
                  type={isPassword ? "password" : "text"}
                  value={modalKeyValue}
                  onChange={(e) => {
                    setModalKeyValue(e.target.value)
                    setModalKeyError("")
                  }}
                  placeholder={t(currentLang, "enterKeyPlaceholder")}
                  className={cn(
                    "pr-10 rounded-md text-[13px]",
                    modalKeyError && "border-[#ff4d4f]"
                  )}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center text-muted-foreground p-0.5"
                  onClick={() => setIsPassword((p) => !p)}
                  aria-label={
                    isPassword
                      ? currentLang === "zh"
                        ? "显示密钥"
                        : "Show key"
                      : currentLang === "zh"
                        ? "隐藏密钥"
                        : "Hide key"
                  }
                >
                  <SpriteIcon
                    id={isPassword ? "plugin-eye-icon" : "plugin-eye-off-icon"}
                    size={16}
                  />
                </button>
              </div>
              {modalKeyError ? (
                <div className="mt-2 text-[13px] text-[#ff4d4f]">{modalKeyError}</div>
              ) : null}
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setApiKeyModalOpen(false)}
              className="flex-1 h-[36px] rounded-md text-[13px]"
            >
              {t(currentLang, "cancel")}
            </Button>
            <Button
              onClick={handleSaveKey}
              disabled={isSavingKey}
              className="flex-1 h-[36px] rounded-md text-[13px] bg-[#2E3BF8] hover:bg-[#2530c9]"
            >
              {isSavingKey ? "..." : t(currentLang, "save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key limit Modal */}
      <Dialog open={keyLimitModalOpen} onOpenChange={setKeyLimitModalOpen}>
        <DialogOverlay />
        <DialogContent className="w-[260px] p-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t(currentLang, "cannotExport")}</DialogTitle>
          </DialogHeader>
          <div className="text-[13px] text-muted-foreground leading-6 mb-3">
            {t(currentLang, "keyLimitReached")}
          </div>
          <DialogFooter>
            <Button
              className="w-full text-[13px] bg-[#2E3BF8] hover:bg-[#2530c9] rounded-md"
              onClick={() => setKeyLimitModalOpen(false)}
            >
              {t(currentLang, "gotIt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Modal */}
      <Dialog
        open={infoModalOpen}
        onOpenChange={(open) => {
          setInfoModalOpen(open)
          if (!open) {
            // user acknowledged the guide
            if (!hasShownInfoModal) {
              setHasShownInfoModal(true)
              window.parent.postMessage(
                { pluginMessage: { type: "save-has-shown-info-modal" } },
                "*"
              )
            }

            if (pendingAction === "toggleCheckbox") {
              if (storedApiKey) setIsCloudCompress(true)
              else openManageKeyModal()
            } else if (pendingAction === "openManageKey") {
              openManageKeyModal()
            }
            setPendingAction(null)
          }
        }}
      >
        <DialogOverlay />
        <DialogContent className="w-[260px] p-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t(currentLang, "howToGetKey")}</DialogTitle>
          </DialogHeader>
          <div className="text-[13px] text-muted-foreground leading-6 mb-3">
            <p dangerouslySetInnerHTML={{ __html: t(currentLang, "infoStep1") as string }} />
            <p>{t(currentLang, "infoStep2")}</p>
            <p>{t(currentLang, "infoStep3")}</p>
            <p className="text-[#ff4d4f]">{t(currentLang, "infoNote")}</p>
          </div>
          <DialogFooter>
            <Button
              className="w-full text-[13px] bg-[#2E3BF8] hover:bg-[#2530c9] rounded-md"
              onClick={() => {
                setInfoModalOpen(false)
              }}
            >
              {t(currentLang, "iGotIt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

