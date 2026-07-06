import json
import os
from openai import OpenAI

# Initialize client using environment key
def get_ai_client():
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def draft_invoice(prompt: str) -> dict:
    client = get_ai_client()
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": f"Turn this job into an invoice. Return JSON {{description: string, amountUsd: number}}. Job: {prompt}"
            }
        ],
        response_format={"type": "json_object"}
    )
    content = r.choices[0].message.content
    if not content:
        raise ValueError("No content returned from OpenAI")
    return json.loads(content)
