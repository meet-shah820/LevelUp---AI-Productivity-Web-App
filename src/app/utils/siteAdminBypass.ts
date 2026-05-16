/** Persists only on this browser; unlock from Settings → Admin preview. */

const STORAGE_KEY = "site_admin_preview_unlock_v1";

export const SITE_ADMIN_BYPASS_UPDATED_EVENT = "app:site-admin-bypass-updated";

export type BillingTierId = "free" | "starter" | "pro" | "elite";

export function readSiteAdminBypassActive(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSiteAdminBypassActive(active: boolean) {
  try {
    if (active) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / privacy mode
  }
  window.dispatchEvent(new CustomEvent(SITE_ADMIN_BYPASS_UPDATED_EVENT));
}

const ADMIN_PREVIEW_PASSWORD = "2311";

/** Value sent as `X-LevelUp-Admin-Preview` when preview is on; must match server env (or dev fallback). */
export const SITE_ADMIN_PREVIEW_SECRET = ADMIN_PREVIEW_PASSWORD;

export function tryUnlockSiteAdminWithPassword(candidate: string): boolean {
  if (candidate !== ADMIN_PREVIEW_PASSWORD) return false;
  setSiteAdminBypassActive(true);
  return true;
}

export function clearSiteAdminBypass() {
  setSiteAdminBypassActive(false);
}

/** After admin preview, API calls include a header so the server applies the same unlock (no payment blocks). */
export function tierForPaidUiGating(actual: BillingTierId, adminBypassActive: boolean): BillingTierId {
  if (adminBypassActive) return "elite";
  return actual;
}
