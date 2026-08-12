const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
  return localStorage.getItem("token");
}

function setToken(token) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
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

// Auth

export async function register(email, password) {
  const data = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export async function login(email, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export function me() {
  return request("/api/auth/me", { method: "GET" });
}

export async function logout() {
  const data = await request("/api/auth/logout", { method: "POST" });
  setToken(null);
  return data;
}

// Videos

export async function uploadVideo(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append("video", file);

  const res = await fetch(`${API_URL}/api/videos/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "upload failed");
  return data;
}

export function getVideoStatus(videoId) {
  return request(`/api/videos/status/${videoId}`, { method: "GET" });
}

export function listVideos() {
  return request(`/api/videos`, { method: "GET" });
}

export function getVideo(videoId) {
  return request(`/api/videos/${videoId}`, { method: "GET" });
}

export function deleteVideo(videoId) {
  return request(`/api/videos/${videoId}`, { method: "DELETE" });
}

export function renameVideo(videoId, name) {
  return request(`/api/videos/${videoId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

// Public / demo

export function getDemoVideo() {
  return request("/api/demo/video", { method: "GET" });
}