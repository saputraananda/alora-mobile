const PWA_TOKEN_KEY = 'alora_pwa_auth_token';
const PWA_USER_KEY = 'alora_pwa_user';
const WEB_TOKEN_KEY = 'alora_auth_token';
const WEB_USER_KEY = 'alora_user';

export function isStandalonePwa() {
  try {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

export function getAuthClient() {
  return isStandalonePwa() ? 'pwa' : 'web';
}

export function getAuthToken() {
  try {
    if (isStandalonePwa()) {
      return localStorage.getItem(PWA_TOKEN_KEY);
    }
    return (
      localStorage.getItem(WEB_TOKEN_KEY) ||
      localStorage.getItem('alora_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem(WEB_TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

export function getAuthUser() {
  try {
    let raw = null;
    if (isStandalonePwa()) {
      raw = localStorage.getItem(PWA_USER_KEY);
    } else {
      raw =
        localStorage.getItem(WEB_USER_KEY) ||
        sessionStorage.getItem(WEB_USER_KEY) ||
        localStorage.getItem('user');
    }
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  try {
    const userJson = JSON.stringify(user || {});
    if (isStandalonePwa()) {
      localStorage.setItem(PWA_TOKEN_KEY, token);
      localStorage.setItem(PWA_USER_KEY, userJson);
      return;
    }
    localStorage.setItem(WEB_TOKEN_KEY, token);
    localStorage.setItem(WEB_USER_KEY, userJson);
  } catch {
    // ignore storage errors
  }
}

export function clearAuthSession() {
  try {
    if (isStandalonePwa()) {
      localStorage.removeItem(PWA_TOKEN_KEY);
      localStorage.removeItem(PWA_USER_KEY);
    } else {
      localStorage.removeItem(WEB_TOKEN_KEY);
      localStorage.removeItem('alora_token');
      localStorage.removeItem(WEB_USER_KEY);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    sessionStorage.clear();
  } catch {
    // ignore storage errors
  }
}

export function readStoredSessionUser() {
  try {
    const token = getAuthToken();
    const user = getAuthUser();
    if (!token || !user) return null;
    return user;
  } catch {
    return null;
  }
}
