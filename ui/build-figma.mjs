import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const distAssetsDir = path.join(__dirname, "dist", "assets")
const jsPath = path.join(distAssetsDir, "index.js")
const cssPath = path.join(distAssetsDir, "style.css")
const iconsPath = path.join(__dirname, "public", "icons.svg")

const outHtmlPath = path.join(__dirname, "..", "ui-react.html")
const outIconsPath = path.join(__dirname, "..", "icons.svg")

const js = fs.readFileSync(jsPath, "utf8")
const css = fs.readFileSync(cssPath, "utf8")
const iconsSvg = fs.readFileSync(iconsPath, "utf8")
fs.writeFileSync(outIconsPath, iconsSvg, "utf8")

// Prevent accidental closing script tag inside the bundle.
const safeJs = js.replace(/<\/script>/gi, "<\\/script>")
const safeCss = css.replace(/<\/style>/gi, "<\\/style>")

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${safeCss}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${safeJs}</script>
  </body>
</html>
`

fs.writeFileSync(outHtmlPath, html, "utf8")
console.log(`[build-figma] wrote: ${outHtmlPath}`)

