import { Suspense } from "react"

export default function Loading() {
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
