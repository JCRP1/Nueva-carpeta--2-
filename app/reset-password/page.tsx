import { ResetPasswordView } from "@/components/reset-password-view"

interface ResetPasswordPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const resolvedSearchParams = await searchParams
  const rawToken = resolvedSearchParams?.token
  const token = Array.isArray(rawToken) ? rawToken[0] || "" : rawToken || ""

  return <ResetPasswordView token={token} />
}
