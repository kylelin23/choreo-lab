const BASE_URL = `${import.meta.env.VITE_API_URL}/api/auth`;

function getToken() {
  return localStorage.getItem("token");
}

function setToken(token) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "request failed");
  return data;
}

export async function register(email, password) {
  const data = await request("/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export async function login(email, password) {
  const data = await request("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export function me() {
  return request("/me", { method: "GET" });
}

export async function logout() {
  const data = await request("/logout", { method: "POST" });
  setToken(null);
  return data;
}
