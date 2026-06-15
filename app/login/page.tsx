"use client"

import { LoginView } from "@/components/login-view"
import type { User } from "@/lib/greensense-data"

export default function LoginPage() {
  function handleLogin(_user: User) {
    window.location.href = "/"
  }

  return <LoginView initialView="login" onLogin={handleLogin} />
}
