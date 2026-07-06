import uuid
import time
from pydantic import BaseModel
from typing import Literal, Dict, Optional

class Invoice(BaseModel):
    id: str
    freelancer: str
    client: str
    description: str
    amountUsd: float
    status: Literal["pending", "paid"]
    chain: str
    createdAt: int

db: Dict[str, Invoice] = {}

def create_invoice(freelancer: str, client: str, description: str, amount_usd: float) -> Invoice:
    inv_id = str(uuid.uuid4())
    inv = Invoice(
        id=inv_id,
        freelancer=freelancer,
        client=client,
        description=description,
        amountUsd=amount_usd,
        status="pending",
        chain="metis",
        createdAt=int(time.time() * 1000)
    )
    db[inv_id] = inv
    return inv

def get_invoice(inv_id: str) -> Optional[Invoice]:
    return db.get(inv_id)

def mark_paid(inv_id: str) -> Optional[Invoice]:
    inv = db.get(inv_id)
    if inv:
        inv.status = "paid"
    return inv
