"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://swingpulse-api-1.onrender.com/api/v1/"

export default function GoogleCallback() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function handleCallback() {
      if (!mounted) return

      const code = searchParams.get("code")
      const errorParam = searchParams.get("error")

      if (errorParam) {
        setError(`Google OAuth error: ${errorParam}`)
        return
      }

      if (!code) {
        setError("No authorization code received from Google")
        return
      }

      try {
        const res = await fetch(`${API_BASE}auth/google/callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Token exchange failed (${res.status})`)
        }

        const data = await res.json()

        if (data.access_token) {
          localStorage.setItem("swingpulse_token", data.access_token)
        }

        if (data.user) {
          localStorage.setItem("swingpulse_user", JSON.stringify(data.user))
        }

        if (mounted) {
          router.replace("/")
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Login failed")
        }
      }
    }

    handleCallback()
    return () => {
      mounted = false
    }
  }, [searchParams, router])

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-[#c0c0c0] text-black">
        <div className="p-4 border-2 border-[#808080] bg-[#c0c0c0] shadow-[4px_4px_0px_#000000] max-w-md w-full font-mono">
          <div className="border-t-2 border-[#ffffff] border-l-2 border-[#ffffff] border-b-2 border-[#808080] border-r-2 border-[#808080] p-1 bg-[#c0c0c0]">
            <div className="flex items-center gap-2 mb-3 bg-[#c0c0c0] px-2 py-1 border-t-1 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080]">
              <div className="w-2 h-2 rounded bg-[#c0c0c0] border border-[#808080]"></div>
              <span className="text-xs font-bold text-black">SWINGPULSE</span>
            </div>
            <h2 className="text-xl font-bold text-black mb-4">SWINGPULSE</h2>
            <div className="text-[10px] text-[#ff0000] font-bold mb-4">LOGIN FAILED</div>
            <div className="text-[10px] text-[#808080] mb-4">{error}</div>
            <button
              onClick={() => router.replace("/")}
              className="w-full py-2 bg-[#c0c0c0] border-2 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080] rounded-none text-black font-bold text-sm hover:bg-[#e0e0e0]"
            >
              RETURN TO LOGIN
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center bg-[#c0c0c0] text-black font-mono">
      <div className="p-4 border-2 border-[#808080] bg-[#c0c0c0] shadow-[4px_4px_0px_#000000] max-w-md w-full">
        <div className="border-t-2 border-[#ffffff] border-l-2 border-[#ffffff] border-b-2 border-[#808080] border-r-2 border-[#808080] p-1 bg-[#c0c0c0]">
          <div className="flex items-center gap-2 mb-3 bg-[#c0c0c0] px-2 py-1 border-t-1 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080]">
            <div className="w-2 h-2 rounded bg-[#c0c0c0] border border-[#808080]"></div>
            <span className="text-xs font-bold text-black">SWINGPULSE</span>
          </div>
          <h2 className="text-xl font-bold text-black mb-4">SWINGPULSE</h2>
          <div className="text-[10px] text-[#808080] font-bold mb-4">
            AUTHENTICATING…
          </div>
          <div className="text-[10px] text-[#808080]">
            Completing Google OAuth2 login. Please wait…
          </div>
        </div>
      </div>
    </div>
  )
}
