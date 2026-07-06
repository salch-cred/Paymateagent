"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

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

  useEffect(() => {
    fetch(`${API_BASE}/invoices/${id}`)
      .then((r) => r.json())
      .then(setInvoice)
      .catch(() => setError("Could not load invoice"))
  }, [id])

  async function handlePay() {
    setStatus("paying")
    setError(null)
    try {
      // 1st call hits the x402-gated route and gets a 402 with payment requirements.
      const res = await fetch(`${API_BASE}/pay/${id}/settle`, { method: "POST" })

      if (res.status === 402) {
        const requirements = await res.json()
        // TODO: use your connected wallet (e.g. wagmi/viem) to sign the
        // payment described in `requirements.accepts[0]`, then retry the
        // request with the resulting X-PAYMENT header, e.g.:
        //
        // const paymentHeader = await createPaymentHeader(requirements, walletClient)
        // const retry = await fetch(`${API_BASE}/pay/${id}/settle`, {
        //   method: "POST",
        //   headers: { "X-PAYMENT": paymentHeader },
        // })
        throw new Error("Wallet payment signing not wired up yet — see TODO in code")
      }

      if (!res.ok) throw new Error(`Settle failed: ${res.status}`)
      setStatus("paid")
    } catch (e) {
      setStatus("error")
      setError(e instanceof Error ? e.message : "Payment failed")
    }
  }

  if (error && !invoice) return <main className="p-8">{error}</main>
  if (!invoice) return <main className="p-8">Loading invoice…</main>

  return (
    <main className="mx-auto max-w-md p-8 space-y-4">
      <h1 className="text-xl font-semibold">Invoice for {invoice.client}</h1>
      <p className="text-sm text-gray-500">{invoice.description}</p>
      <p className="text-3xl font-bold">${invoice.amountUsd.toFixed(2)}</p>
      <p className="text-xs uppercase tracking-wide text-gray-400">
        {invoice.status} · {invoice.chain}
      </p>

      {invoice.status === "paid" || status === "paid" ? (
        <div className="rounded bg-green-100 p-3 text-green-800">Paid ✅</div>
      ) : (
        <button
          onClick={handlePay}
          disabled={status === "paying"}
          className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {status === "paying" ? "Processing…" : "Pay now"}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  )
}
