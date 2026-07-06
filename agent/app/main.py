from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os

# Load from parent directory's .env file
load_dotenv(dotenv_path="../.env")

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

@app.post("/pay/{invoice_id}/settle")
async def settle_invoice_endpoint(invoice_id: str, request: Request):
    inv = get_invoice(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    try:
        # In Week 2/3 core payment cycle: mark paid and record reputation on chain.
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
    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=True)
