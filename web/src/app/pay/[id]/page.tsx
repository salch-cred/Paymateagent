"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi"
import { injected } from "wagmi/connectors"
import { parseUnits, custom } from "viem"
import { createWalletClient } from "viem"
import { metisSepolia } from "viem/chains"

type Invoice = {
  id: string
  freelancer: string
  client: string
  description: string
  amountUsd: number
  status: "pending" | "paid"
  chain: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001"

export default function PayPage() {
  const { id } = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [status, setStatus] = useState<"idle" | "paying" | "paid" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // wagmi hooks
  const { address, isConnected, chain } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()

  useEffect(() => {
    fetch(`${API_BASE}/invoices/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Invoice not found")
        return r.json()
      })
      .then((data) => {
        setInvoice(data)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message || "Could not load invoice")
        setLoading(false)
      })
  }, [id])

  async function handlePay() {
    if (!isConnected || !address) {
      setError("Please connect your wallet first.")
      return
    }

    setStatus("paying")
    setError(null)

    try {
      // 1. Switch network to Metis Sepolia if needed
      if (chain?.id !== metisSepolia.id) {
        setStatus("paying") // Update UI state
        await switchChainAsync({ chainId: metisSepolia.id })
      }

      // 2. Fetch x402 payment challenge from backend
      const res = await fetch(`${API_BASE}/pay/${id}/settle`, { method: "POST" })

      if (res.status !== 402) {
        if (res.ok) {
          setStatus("paid")
          return
        }
        throw new Error(`Server returned unexpected status: ${res.status}`)
      }

      const requirements = await res.json()
      const paymentOption = requirements.accepts?.[0]
      if (!paymentOption) {
        throw new Error("No valid payment options returned by the agent.")
      }

      const payTo = paymentOption.payTo
      const tokenAddress = paymentOption.token || "0x228B00..." // Target USDC token address
      const priceStr = paymentOption.price.replace("$", "")
      
      // Metis Sepolia Testnet USDC generally has 6 decimals
      const amount = parseUnits(priceStr, 6)

      // 3. Request wallet client signature for the transfer
      if (!(window as any).ethereum) {
        throw new Error("No Web3 provider injected in browser. Please install MetaMask.")
      }
      
      const walletClient = createWalletClient({
        chain: metisSepolia,
        transport: custom((window as any).ethereum)
      })

      // 4. Send transaction transferring USDC to the payee address
      const txHash = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: [
          {
            inputs: [
              { name: "recipient", type: "address" },
              { name: "amount", type: "uint256" }
            ],
            name: "transfer",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function"
          }
        ],
        functionName: "transfer",
        args: [payTo as `0x${string}`, amount],
        account: address
      })

      // 5. Submit transaction hash to settle route
      const settleRes = await fetch(`${API_BASE}/pay/${id}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT": txHash
        }
      })

      if (!settleRes.ok) {
        const errDetail = await settleRes.json().catch(() => ({}))
        throw new Error(errDetail.detail || "Payment settlement verification failed.")
      }

      setStatus("paid")
      if (invoice) {
        setInvoice({ ...invoice, status: "paid" })
      }
    } catch (e: any) {
      setStatus("error")
      setError(e.message || "Payment failed.")
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-500 border-t-transparent mx-auto"></div>
          <p className="text-slate-400 font-medium">Loading PayMate Invoice...</p>
        </div>
      </main>
    )
  }

  if (error && !invoice) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white p-6">
        <div className="max-w-md w-full rounded-2xl bg-slate-800/50 border border-slate-700/60 p-8 text-center space-y-4">
          <span className="text-5xl">⚠️</span>
          <h1 className="text-xl font-bold text-red-400">Error Loading Invoice</h1>
          <p className="text-slate-300">{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white p-6 relative overflow-hidden">
      {/* Decorative background blur blobs */}
      <div className="absolute top-[-20%] left-[-20%] h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none"></div>

      <div className="relative max-w-md w-full rounded-3xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl p-8 shadow-2xl space-y-8">
        
        {/* Wallet Status Area */}
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-400 animate-ping"></span>
            <span className="text-sm font-semibold tracking-wider text-violet-400 uppercase">PayMate Terminal</span>
          </div>
          {isConnected ? (
            <button
              onClick={() => disconnect()}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition duration-300"
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="text-xs font-semibold px-4 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500 border border-violet-500/40 transition duration-300 shadow-md shadow-violet-600/20"
            >
              Connect Wallet
            </button>
          )}
        </div>

        {/* Invoice Summary */}
        {invoice && (
          <div className="space-y-6">
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-widest text-slate-400">Client Invoice</span>
              <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                {invoice.client.slice(0, 8)}...{invoice.client.slice(-6)}
              </h2>
              <p className="text-slate-300 leading-relaxed font-light">{invoice.description}</p>
            </div>

            <div className="bg-slate-950/50 border border-slate-800/40 rounded-2xl p-6 text-center space-y-1">
              <span className="text-xs tracking-wider text-slate-400 uppercase">Amount Due</span>
              <div className="text-4xl font-extrabold text-white tracking-tight">
                ${invoice.amountUsd.toFixed(2)}
              </div>
              <div className="text-[10px] tracking-widest text-violet-400 uppercase font-semibold">
                Settling via USDC on Metis Testnet
              </div>
            </div>

            {/* Action State Section */}
            {invoice.status === "paid" || status === "paid" ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl bg-green-500/10 border border-green-500/30 py-4 text-green-400 font-bold text-center tracking-wide">
                <span>Paid Successfully</span>
                <span className="text-lg">✅</span>
              </div>
            ) : (
              <button
                onClick={handlePay}
                disabled={status === "paying"}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 py-4 text-sm font-bold text-white transition duration-300 shadow-lg shadow-violet-600/30 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01]"
              >
                {status === "paying" ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <span>Settle Invoice via x402</span>
                )}
              </button>
            )}

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-400 leading-relaxed">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
