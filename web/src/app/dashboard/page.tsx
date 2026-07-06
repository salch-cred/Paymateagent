"use client"

import { useState, useEffect } from "react"
import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected } from "wagmi/connectors"

type Reputation = {
  jobsCompleted: number
  totalEarnedUsd: number
  score: number
}

type GeneratedInvoice = {
  id: string
  description: string
  amountUsd: number
  status: string
  payUrl: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001"

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  // Form states
  const [clientWallet, setClientWallet] = useState("")
  const [jobPrompt, setJobPrompt] = useState("")
  const [generating, setGenerating] = useState(false)
  const [genInvoice, setGenInvoice] = useState<GeneratedInvoice | null>(null)
  
  // Rep stats states
  const [reputation, setReputation] = useState<Reputation | null>(null)
  const [loadingRep, setLoadingRep] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch reputation stats whenever the connected address changes
  useEffect(() => {
    if (isConnected && address) {
      setLoadingRep(true)
      fetch(`${API_BASE}/reputation/${address}`)
        .then((r) => {
          if (!r.ok) throw new Error("Reputation not found")
          return r.json()
        })
        .then((data) => {
          setReputation(data)
          setLoadingRep(false)
        })
        .catch((e) => {
          console.error(e)
          setLoadingRep(false)
        })
    } else {
      setReputation(null)
    }
  }, [isConnected, address])

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!address) {
      setError("Please connect your wallet first.")
      return
    }
    if (!clientWallet || !jobPrompt) {
      setError("Please fill out both client wallet and job description.")
      return
    }

    setGenerating(true)
    setError(null)
    setGenInvoice(null)

    try {
      const res = await fetch(`${API_BASE}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freelancer: address,
          client: clientWallet,
          prompt: jobPrompt,
        }),
      })

      if (!res.ok) throw new Error(`Drafting failed: ${res.status}`)
      const data = await res.json()
      
      setGenInvoice({
        id: data.invoice.id,
        description: data.invoice.description,
        amountUsd: data.invoice.amountUsd,
        status: data.invoice.status,
        payUrl: `${window.location.origin}${data.payUrl}`,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not generate invoice")
    } finally {
      setGenerating(false)
    }
  }

  function handleCopyLink() {
    if (genInvoice) {
      navigator.clipboard.writeText(genInvoice.payUrl)
      alert("Payment link copied to clipboard!")
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8 relative overflow-hidden flex flex-col items-center">
      {/* Decorative background blur blobs */}
      <div className="absolute top-[-30%] right-[-10%] h-[600px] w-[600px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none"></div>

      <div className="max-w-5xl w-full space-y-10 relative z-10">
        
        {/* Header Section */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-900 pb-6 gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              PayMate Dashboard
            </h1>
            <p className="text-sm text-slate-400 font-light">Draft AI-powered invoices and manage your on-chain reputation.</p>
          </div>

          <div>
            {isConnected ? (
              <div className="flex items-center gap-3">
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full font-semibold">
                  Connected
                </span>
                <button
                  onClick={() => disconnect()}
                  className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition duration-300"
                >
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </button>
              </div>
            ) : (
              <button
                onClick={() => connect({ connector: injected() })}
                className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 border border-violet-500/40 transition duration-300 shadow-lg shadow-violet-600/20"
              >
                Connect Web3 Wallet
              </button>
            )}
          </div>
        </header>

        {/* Connection Notice / Empty State */}
        {!isConnected && (
          <section className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-10 text-center space-y-4 backdrop-blur-md">
            <span className="text-5xl block">🔌</span>
            <h2 className="text-xl font-bold">Wallet Connection Required</h2>
            <p className="text-slate-400 max-w-md mx-auto font-light">
              Connect your Ethereum/Metis wallet to view your ERC-8004 reputation credentials and start issuing invoices.
            </p>
            <button
              onClick={() => connect({ connector: injected() })}
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold transition duration-300"
            >
              Connect Wallet
            </button>
          </section>
        )}

        {isConnected && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left: Invoice Generator Form */}
            <div className="lg:col-span-2 space-y-8">
              <section className="bg-slate-900/40 border border-slate-900/80 backdrop-blur-xl rounded-3xl p-8 space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-violet-400 text-lg">📝</span> Create New Invoice
                </h2>
                
                <form onSubmit={handleCreateInvoice} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Client Wallet Address</label>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={clientWallet}
                      onChange={(e) => setClientWallet(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition duration-200"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Describe Job / Service Details</label>
                    <textarea
                      rows={4}
                      placeholder="E.g., 10 hours of smart contract auditing at $100/hr, completed milestones 1 and 2."
                      value={jobPrompt}
                      onChange={(e) => setJobPrompt(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition duration-200 resize-none"
                    />
                  </div>

                  {error && (
                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold transition duration-200 disabled:opacity-50"
                  >
                    {generating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        <span>Agent Drafting Invoice...</span>
                      </>
                    ) : (
                      <span>Draft Invoice via AI Agent</span>
                    )}
                  </button>
                </form>
              </section>

              {/* Generated Invoice Result Card */}
              {genInvoice && (
                <section className="bg-slate-900/60 border border-emerald-500/20 rounded-3xl p-8 space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                      <span>✓</span> Invoice Successfully Drafted
                    </h3>
                    <span className="text-xs uppercase bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-semibold">
                      {genInvoice.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-950/40 border border-slate-900 rounded-2xl p-6">
                    <div className="space-y-1">
                      <span className="text-xs text-slate-400 uppercase font-medium">Job Details</span>
                      <p className="text-sm font-light text-slate-200">{genInvoice.description}</p>
                    </div>
                    <div className="space-y-1 text-left sm:text-right">
                      <span className="text-xs text-slate-400 uppercase font-medium">Calculated Amount</span>
                      <p className="text-2xl font-black text-white">${genInvoice.amountUsd.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Share Payment Link</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={genInvoice.payUrl}
                        className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none text-slate-300"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold text-xs transition duration-200"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* Right: Reputation Scorecard */}
            <div className="space-y-8">
              <section className="bg-slate-900/40 border border-slate-900/80 backdrop-blur-xl rounded-3xl p-8 space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-violet-400 text-lg">🛡️</span> On-Chain Reputation
                </h2>

                {loadingRep ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent"></div>
                    <span className="text-xs text-slate-400">Loading ERC-8004 stats...</span>
                  </div>
                ) : reputation ? (
                  <div className="space-y-6">
                    {/* Primary Score Grid */}
                    <div className="bg-gradient-to-br from-violet-900/20 to-indigo-950/20 border border-violet-500/10 rounded-2xl p-6 text-center space-y-1">
                      <span className="text-[10px] tracking-widest text-violet-400 uppercase font-semibold">Reputation Score</span>
                      <div className="text-5xl font-black text-white tracking-tight">{reputation.score}</div>
                      <span className="text-[10px] text-slate-400 font-light">ERC-8004 Verified Credentials</span>
                    </div>

                    {/* Stats List */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                        <span className="text-sm text-slate-400">Jobs Completed</span>
                        <span className="font-bold text-slate-200">{reputation.jobsCompleted}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Total Earned</span>
                        <span className="font-bold text-slate-200">${reputation.totalEarnedUsd.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-sm font-light">
                    No reputation score recorded on Metis Sepolia testnet yet.
                  </div>
                )}
              </section>
            </div>

          </div>
        )}
      </div>
    </main>
  )
}
