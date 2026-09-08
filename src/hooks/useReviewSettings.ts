import { useCallback, useEffect, useState } from 'react'

/** Long-response hazard threshold, in seconds. 0 = off. */
export type HazardThreshold = 15 | 60 | 0

export type ReviewSettings = {
  /** Hides Hard/Easy, showing only Again/Good. */
  binaryMode: boolean
  /** Kills chain/combo + red/orange/shake/flash/hazard feedback. */
  calmMode: boolean
  hazardThreshold: HazardThreshold
}

const DEFAULTS: ReviewSettings = {
  binaryMode: false,
  calmMode: false,
  hazardThreshold: 60,
}

const STORAGE_KEY = 'srs.review-settings'

function load(): ReviewSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ReviewSettings>) }
  } catch {
    return DEFAULTS
  }
}

/**
 * Stand-in for the not-yet-built OPTIONS screen (CLAUDE.md build step 5/7).
 * Per CLAUDE.md, binary mode's toggle belongs off the review screen — this
 * hook is what a future Options screen will read and write; the review
 * screen only reads it.
 */
export function useReviewSettings() {
  const [settings, setSettings] = useState<ReviewSettings>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Private browsing / storage disabled — settings just won't persist.
    }
  }, [settings])

  const update = useCallback((patch: Partial<ReviewSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  return [settings, update] as const
}
