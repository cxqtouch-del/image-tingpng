import JSZip from "jszip"

export type ZipFile = {
  filename: string
  bytes: Uint8Array
}

function sanitizeName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "_")
}

function buildUniqueFilename(name: string, usedNames: Map<string, number>) {
  const safeName = sanitizeName(name)
  const dotIndex = safeName.lastIndexOf(".")
  const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName
  const extension = dotIndex > 0 ? safeName.slice(dotIndex) : ""
  const currentCount = usedNames.get(safeName) ?? 0

  if (currentCount === 0) {
    usedNames.set(safeName, 1)
    return safeName
  }

  const nextName = `${baseName} (${currentCount + 1})${extension}`
  usedNames.set(safeName, currentCount + 1)
  return nextName
}

export async function buildZip(files: ZipFile[]) {
  const zip = new JSZip()
  const usedNames = new Map<string, number>()

  for (const file of files) {
    const filename = buildUniqueFilename(file.filename, usedNames)
    zip.file(filename, file.bytes, {
      binary: true,
      compression: "STORE",
    })
  }

  return zip.generateAsync({
    type: "blob",
    compression: "STORE",
    mimeType: "application/zip",
  })
}

