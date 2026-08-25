const DRAFT_KEY = 'alora.bugar.activeDraft'
const DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000

export function saveBugarDraft(draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }))
}

export function loadBugarDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw)
    const age = Date.now() - new Date(draft.updatedAt).getTime()
    if (age > DRAFT_MAX_AGE_MS) {
      clearBugarDraft()
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function clearBugarDraft() {
  localStorage.removeItem(DRAFT_KEY)
}
