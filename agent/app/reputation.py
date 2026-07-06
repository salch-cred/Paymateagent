import os
from web3 import Web3

ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "freelancer", "type": "address"},
            {"internalType": "uint256", "name": "amountUsd", "type": "uint256"}
        ],
        "name": "recordJob",
        "outputs": [],
        "stateMutability": "external",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "freelancer", "type": "address"}
        ],
        "name": "getReputation",
        "outputs": [
            {
                "components": [
                    {"internalType": "uint256", "name": "jobsCompleted", "type": "uint256"},
                    {"internalType": "uint256", "name": "totalEarnedUsd", "type": "uint256"},
                    {"internalType": "uint256", "name": "score", "type": "uint256"}
                ],
                "internalType": "struct PayMateReputation.Rep",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

def get_web3():
    rpc_url = os.getenv("RPC_METIS_TESTNET", "https://sepolia.metisdevops.link")
    return Web3(Web3.HTTPProvider(rpc_url))

async def mint_reputation(freelancer: str, amount_usd: float):
    w3 = get_web3()
    contract_address = os.getenv("REPUTATION_CONTRACT")
    if not contract_address or contract_address == "0x...":
        print("REPUTATION_CONTRACT address not set or invalid in .env")
        return
        
    private_key = os.getenv("PRIVATE_KEY")
    if not private_key or private_key == "0x...":
        print("PRIVATE_KEY not set or invalid in .env")
        return

    contract_address = w3.to_checksum_address(contract_address)
    freelancer = w3.to_checksum_address(freelancer)
    
    contract = w3.eth.contract(address=contract_address, abi=ABI)
    account = w3.eth.account.from_key(private_key)
    
    tx = contract.functions.recordJob(freelancer, int(amount_usd)).build_transaction({
        'from': account.address,
        'nonce': w3.eth.get_transaction_count(account.address),
        'gas': 200000,
        'gasPrice': w3.eth.gas_price
    })
    
    signed_tx = w3.eth.account.sign_transaction(tx, private_key=private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash)

async def get_reputation_data(freelancer: str):
    w3 = get_web3()
    contract_address = os.getenv("REPUTATION_CONTRACT")
    if not contract_address or contract_address == "0x...":
        return {"jobsCompleted": 0, "totalEarnedUsd": 0, "score": 0}
        
    contract_address = w3.to_checksum_address(contract_address)
    freelancer = w3.to_checksum_address(freelancer)
    
    contract = w3.eth.contract(address=contract_address, abi=ABI)
    rep = contract.functions.getReputation(freelancer).call()
    
    return {
        "jobsCompleted": rep[0],
        "totalEarnedUsd": rep[1],
        "score": rep[2]
    }
