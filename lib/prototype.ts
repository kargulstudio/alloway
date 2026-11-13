import { toast } from "sonner"

/**
 * Every control in the prototype does *something*. Controls whose feature
 * isn't built yet say so instead of silently doing nothing. One shared toast
 * id, so repeated clicks replace the toast rather than stacking it.
 */
export function comingSoon(feature: string) {
  toast(`${feature} is coming soon`, { id: "coming-soon" })
}
