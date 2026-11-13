import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

/** Read once at module scope — the icon never depends on request data. */
const logo = await readFile(join(process.cwd(), "public/figma/logo.svg"), "base64")

/** iOS home-screen icon: the Alloway logo mark on white (iOS applies its own corner mask). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFFFF",
        }}
      >
        <img src={`data:image/svg+xml;base64,${logo}`} width={112} height={112} alt="" />
      </div>
    ),
    size
  )
}
