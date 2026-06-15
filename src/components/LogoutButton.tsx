// src/components/LogoutButton.tsx
"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return <button onClick={logout} className="text-sm text-gray-500">登出</button>;
}
