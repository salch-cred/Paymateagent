from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Any
import os
import asyncio

# Load from parent directory's .env file
load_dotenv(dotenv_path="../.env")

# Import x402 components
from x402 import x402ResourceServer
from x402.http import HTTPFacilitatorClient
from x402.http.middleware.fastapi import payment_middleware

from app.invoice import create_invoice, get_invoice, mark_paid
from app.agent import draft_invoice
from app.reputation import mint_reputation, get_reputation_data

app = FastAPI(title="PayMate Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RECEIVER_WALLET = os.getenv("RECEIVER_WALLET")
FACILITATOR_URL = os.getenv("FACILITATOR_URL", "https://x402.org/facilitator")

class InvoiceRequest(BaseModel):
    freelancer: str
    client: str
    prompt: str

@app.post("/invoices")
async def create_invoice_endpoint(req: InvoiceRequest):
    try:
        draft = await draft_invoice(req.prompt)
        inv = create_invoice(
            freelancer=req.freelancer,
            client=req.client,
            description=draft.get("description", "Freelance work"),
            amount_usd=float(draft.get("amountUsd", 0))
        )
        return {"invoice": inv, "payUrl": f"/pay/{inv.id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/invoices/{invoice_id}")
async def get_invoice_endpoint(invoice_id: str):
    inv = get_invoice(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv

# Helper to emulate require_payment middleware from build guide
def require_payment(path: str, price: Any, pay_to_address: Any, network: str, facilitator_url: str):
    def price_wrapper(context: Any):
        request = context.adapter._request
        if callable(price):
            return price(request)
        return price

    routes = {
        path: {
            "accepts": {
                "scheme": "exact",
                "payTo": pay_to_address,
                "price": price_wrapper,
                "network": network,
            }
        }
    }
    
    facilitator = HTTPFacilitatorClient(url=facilitator_url)
    server = x402ResourceServer(facilitator)
    return payment_middleware(routes, server)

# --- x402 payment gate ---
async def _invoice_price(request: Request) -> str:
    invoice_id = request.path_params.get("invoice_id")
    inv = get_invoice(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == "paid":
        raise HTTPException(status_code=400, detail="Invoice already paid")
    return f"${inv.amountUsd:.2f}"

app.middleware("http")(
    require_payment(
        path="/pay/*/settle",
        price=_invoice_price,
        pay_to_address=RECEIVER_WALLET,
        network="metis-testnet",
        facilitator_url=FACILITATOR_URL,
    )
)

@app.post("/pay/{invoice_id}/settle")
async def settle_invoice_endpoint(invoice_id: str, request: Request):
    inv = get_invoice(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    try:
        updated_inv = mark_paid(invoice_id)
        if not updated_inv:
             raise HTTPException(status_code=404, detail="Invoice not found")
        
        await mint_reputation(updated_inv.freelancer, updated_inv.amountUsd)
        return {"ok": True, "invoice": updated_inv}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reputation/{address}")
async def get_reputation_endpoint(address: str):
    try:
        rep = await get_reputation_data(address)
        return rep
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=3001, reload=True)
