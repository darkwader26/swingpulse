"use client"

import { useState } from "react"

const WATCHLIST = [
  { sym: "AAPL", px: 189.50, ch: +1.24 },
  { sym: "NVDA", px: 872.00, ch: +2.10 },
  { sym: "MSFT", px: 418.30, ch: -0.45 },
  { sym: "AMD", px: 145.20, ch: +0.88 },
  { sym: "TLT", px: 92.40, ch: -1.10 },
]

const PIPELINE = [
  { name: "SCANNER", status: "ONLINE", items: 42 },
  { name: "SIGNAL GEN", status: "ACTIVE", items: 6 },
  { name: "RISK MGMT", status: "GATED", items: 3 },
  { name: "EXECUTION", status: "PAPER", items: 2 },
  { name: "OPS", status: "LOGGING", items: 2 },
]

export default function Dashboard() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [userName, setUserName] = useState("")
  const [terminalInput, setTerminalInput] = useState("")
  const [terminalLines, setTerminalLines] = useState([
    "C:\\SWINGPULSE> SYSTEM INITIALIZED",
    "C:\\SWINGPULSE> LOADING MODULES...",
    "C:\\SWINGPULSE> MARKET DATA CONNECTED",
    "C:\\SWINGPULSE> AGENT PIPELINE READY",
    "C:\\SWINGPULSE> AWAITING USER LOGON",
  ])

  const handleGoogleLogin = () => {
    setLoggedIn(true)
    setUserName("Trader_01")
    setTerminalLines((prev) => [
      ...prev,
      "C:\\SWINGPULSE> AUTHENTICATING VIA GOOGLE OAUTH2...",
      "C:\\SWINGPULSE> TOKEN ACQUIRED",
      "C:\\SWINGPULSE> USER LOGGED IN: Trader_01",
    ])
  }

  const handleTerminalSubmit = (e) => {
    e.preventDefault()
    if (!terminalInput.trim()) return
    const input = terminalInput.trim()
    setTerminalLines((prev) => [...prev, `C:\\SWINGPULSE> ${input}`])
    setTerminalInput("")
    setTimeout(() => {
      setTerminalLines((prev) => [
        ...prev,
        `C:\\SWINGPULSE> Command '${input}' executed`,
      ])
    }, 500)
  }

  if (!loggedIn) {
    return (
      <div className="h-full flex items-center justify-center bg-[#c0c0c0] font-[\"Courier_New\"] text-black">
        <div className="p-4 border-2 border-[#808080] bg-[#c0c0c0] shadow-[4px_4px_0px_#000000] max-w-md w-full">
          <div className="border-t-2 border-[#ffffff] border-l-2 border-[#ffffff] border-b-2 border-[#808080] border-r-2 border-[#808080] p-1 bg-[#c0c0c0]">
            <div className="flex items-center gap-2 mb-3 bg-[#c0c0c0] px-2 py-1 border-t-1 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080]">
              <div className="w-2 h-2 rounded bg-[#c0c0c0] border border-[#808080]"></div>
              <span className="text-xs font-bold text-black">SWINGPULSE</span>
            </div>
            <h2 className="text-xl font-bold text-black mb-4">SWINGPULSE</h2>
            <div className="text-[10px] text-[#808080] mb-6">
              AGENT-PIPELINE SWING TRADING DESK<br />
              VERSION 1.0.0 - PAPER TRADING MODE
            </div>
            <button
              onClick={handleGoogleLogin}
              className="w-full py-2 bg-[#c0c0c0] border-2 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080] rounded-none text-black font-bold text-sm hover:bg-[#e0e0e0] active:border-t-2 border-[#808080] active:border-l-2 border-[#808080] active:border-b-2 border-[#ffffff] active:border-r-2 border-[#ffffff] active:translate-y-1"
            >
              LOGIN WITH GOOGLE
            </button>
            <div className="mt-3 text-[10px] text-[#808080]">
              SECURE OAUTH2 AUTHENTICATION REQUIRED<br />
              NO LIVE CAPITAL - PAPER TRADING ONLY
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#c0c0c0] font-[\"Courier_New\"] text-black overflow-hidden">
      <header className="h-8 border-t-2 border-[#ffffff] border-l-2 border-[#ffffff] border-b-2 border-[#808080] border-r-2 border-[#808080] bg-[#c0c0c0] flex items-center justify-between px-2 z-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#c0c0c0] border border-[#808080]"></div>
          <span className="text-xs font-bold text-black">SWINGPULSE DESK TERMINAL</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-5 h-5 bg-[#c0c0c0] border border-[#808080] text-black text-[10px] font-bold"></button>
          <button className="w-5 h-5 bg-[#c0c0c0] border border-[#808080] text-black text-[10px] font-bold"></button>
          <button className="w-5 h-5 bg-[#c0c0c0] border border-[#808080] text-black text-[10px] font-bold"></button>
        </div>
      </header>

      <div className="flex-1 flex h-full overflow-hidden bg-[#c0c0c0]">
        <div className="w-1/3 border-r-2 border-[#808080] border-t-2 border-[#ffffff] border-l-2 border-[#ffffff] border-b-2 border-[#808080] border-r-2 border-[#808080] bg-[#c0c0c0] p-1 overflow-y-auto">
          <div className="flex items-center gap-1 mb-1 bg-[#c0c0c0] px-1 py-0.5 border-t-1 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080]">
            <span className="text-[9px] font-bold text-black">C:\\SWINGPULSE\\WATCHLIST</span>
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b-2 border-[#808080]">
                <th className="text-left pb-1 text-[#808080] font-bold">SYMBOL</th>
                <th className="text-right pb-1 text-[#808080] font-bold">PRICE</th>
                <th className="text-right pb-1 text-[#808080] font-bold">CHANGE</th>
              </tr>
            </thead>
            <tbody>
              {WATCHLIST.map((w) => (
                <tr key={w.sym} className="border-b border-[#c0c0c0] hover:bg-[#e0e0e0]">
                  <td className="py-1 font-mono">{w.sym}</td>
                  <td className="py-1 text-right font-mono">${w.px.toFixed(2)}</td>
                  <td className={`py-1 text-right font-mono ${w.ch >= 0 ? "text-[#008000]" : "text-[#ff0000]"}`}>
                    {w.ch >= 0 ? "+" : ""}${w.ch.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="w-1/3 border-r-2 border-[#808080] border-t-2 border-[#ffffff] border-l-2 border-[#ffffff] border-b-2 border-[#808080] border-r-2 border-[#808080] bg-[#000000] p-1 flex flex-col">
          <div className="flex justify-between items-center mb-1 bg-[#c0c0c0] px-1 py-0.5 border-t-1 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080]">
            <span className="text-[9px] font-bold text-black">C:\\SWINGPULSE\\TERMINAL</span>
            <span className="text-[#ffff00] text-xs">v1.0.0</span>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#000000] p-1 border-2 border-[#808080]">
            {terminalLines.map((line, i) => (
              <div key={i} className="mb-[2px]">
                {line.includes("ERROR") || line.includes("FAIL") ? (
                  <span className="text-[#ff0000]">{line}</span>
                ) : line.includes("APPROVED") || line.includes("ONLINE") || line.includes("READY") ? (
                  <span className="text-[#00ff00]">{line}</span>
                ) : line.includes("WARNING") || line.includes("PENDING") ? (
                  <span className="text-[#ffff00]">{line}</span>
                ) : (
                  <span>{line}</span>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={handleTerminalSubmit} className="mt-1 flex gap-1 bg-[#c0c0c0] p-1 border-t-1 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080]">
            <input
              type="text"
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              className="flex-1 bg-[#000000] text-[#00ff00] border border-[#808080] px-1 py-0.5 text-sm font-mono focus:outline-none"
              placeholder="C:\\SWINGPULSE>"
            />
            <button
              type="submit"
              className="bg-[#c0c0c0] border-2 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080] px-2 py-0.5 text-black text-[10px] font-bold hover:bg-[#e0e0e0]"
            >
              ENTER
            </button>
          </form>
        </div>

        <div className="w-1/3 bg-[#c0c0c0] p-1 overflow-y-auto">
          <div className="flex justify-between items-center mb-1 bg-[#c0c0c0] px-1 py-0.5 border-t-1 border-[#ffffff] border-l-1 border-[#ffffff] border-b-1 border-[#808080] border-r-1 border-[#808080]">
            <span className="text-[9px] font-bold text-black">AGENT PIPELINE</span>
            <span className="text-[#ffff00] text-xs">SWING DESK</span>
          </div>
          <div className="space-y-1">
            {PIPELINE.map((agent, i) => (
              <div key={agent.name} className="flex items-center gap-1 p-1 border border-[#808080] bg-[#c0c0c0] rounded-none">
                <div className={`w-2 h-2 ${agent.status === "ONLINE" || agent.status === "ACTIVE" ? "bg-[#008000]" : agent.status === "PAPER" ? "bg-[#ffff00]" : "bg-[#ff0000]"}`}></div>
                <span className="text-[10px] font-mono text-black">{agent.name}</span>
                <span className="text-[#ffff00] text-xs ml-1">{agent.items}</span>
                <span className="text-[10px] text-[#008000] ml-auto">{agent.status}</span>
                {i < PIPELINE.length - 1 && <span className="text-[#008000] text-xs">→</span>}
              </div>
            ))}
          </div>
          <div className="mt-2 border border-[#808080] p-1 bg-[#c0c0c0]">
            <span className="text-[9px] font-bold text-black block mb-1">SYSTEM RESOURCES</div>
            <div className="flex justify-between text-[9px] mb-0.5">
              <span className="text-black">CPU</span>
              <span className="text-right text-black">42%</span>
            </div>
            <div className="w-full bg-[#808080] h-1">
              <div className="bg-[#008000] h-full" style={{ width: "42%" }}></div>
            </div>
            <div className="flex justify-between text-[9px] mb-0.5">
              <span className="text-black">MEMORY</span>
              <span className="text-right text-black">68%</span>
            </div>
            <div className="w-full bg-[#808080] h-1">
              <div className="bg-[#ffff00] h-full" style={{ width: "68%" }}></div>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-black">NETWORK</span>
              <span className="text-right text-black">12%</span>
            </div>
            <div className="w-full bg-[#808080] h-1">
              <div className="bg-[#008000] h-full" style={{ width: "12%" }}></div>
            </div>
          </div>
        </div>
      </div>

      <footer className="h-6 border-t-2 border-[#ffffff] border-l-2 border-[#ffffff] border-b-2 border-[#808080] border-r-2 border-[#808080] bg-[#c0c0c0] flex items-center justify-between px-2 text-[9px] text-[#808080] z-10">
        <span>SWINGPULSE v1.0.0 - PAPER TRADING MODE</span>
        <span>NO LIVE CAPITAL - NOT FINANCIAL ADVICE</span>
      </footer>
    </div>
  )
}
