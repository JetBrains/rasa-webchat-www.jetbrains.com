









const getTokenPayload = (token: string) => {
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    return atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  } catch (e) {
    return null;
  }
};

export const getIsTokenValid = (token: string) => {
  if (!token) return false;

  try {
    const payload = getTokenPayload(token);
    if (!payload) return false;

    const { exp } = JSON.parse(payload) || {};

    if (!exp) return false;

    const now = Date.now() / 1000;
    return exp > now;
  } catch (e) {
    return false;
  }
};

export const getTokenExpirationTime = (token:string) => {
  if (!token) return null;

  try {
    const payload = getTokenPayload(token);
    if (!payload) return null
    const { exp } = JSON.parse(payload) || {};

    return exp ? exp * 1000 : null;
  } catch (e) {
    return null;
  }
};
