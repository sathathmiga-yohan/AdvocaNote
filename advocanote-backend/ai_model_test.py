
from ollama import chat

legal_note = """
Today case number 125 was called in District Court.
The opposing party requested more time.
The next hearing is December 15, 2026.
I need to prepare documents and contact my client.
"""

response = chat(
    model="qwen3.5:0.8b",
    messages=[
        {
            "role": "system",
            "content": (
                "You are AdvocaNote Legal Diary Assistant. "
                "Analyze the provided legal notes. "
                "Return a clear summary, important points, "
                "hearing dates and suggested tasks. "
                "Never invent missing details."
            )
        },
        {
            "role": "user",
            "content": legal_note
        }
    ],
    think=False
)

print(response.message.content)
