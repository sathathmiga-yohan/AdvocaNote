
import json
from ollama import chat

# =====================================
# ADVOCANOTE - SAMPLE LEGAL NOTE
# =====================================

legal_note = """
Today case number 125 was called in District Court.
The opposing party requested more time.
The next hearing is December 15, 2026.
I need to prepare documents and contact my client.
"""

# =====================================
# ADVOCANOTE AI INSTRUCTIONS
# =====================================

SYSTEM_PROMPT = """
You are AdvocaNote Legal Diary AI.

You are an information extraction assistant
for Sri Lankan lawyers.

STRICT RULES:

1. Extract only information explicitly mentioned
   in the provided legal diary note.

2. Never invent case details, court names,
   hearing dates, legal events or documents.

3. Do not assume that any motion was filed.

4. Do not provide legal advice or legal strategies.

5. Generate a short, clear summary.

6. Extract important points from the note.

7. Identify only tasks explicitly mentioned
   by the lawyer.

8. If information is missing, return null.

9. Preserve the original meaning.

10. Never automatically approve or save tasks.
    Lawyer confirmation is required.

Return ONLY valid JSON with this structure:

{
    "case_number": null,
    "court": null,
    "next_hearing_date": null,
    "summary": "",
    "important_points": [],
    "suggested_tasks": []
}

Do not include explanations outside JSON.
"""

# =====================================
# RUN LOCAL QWEN MODEL
# =====================================

try:
    response = chat(
        model="qwen3.5:0.8b",
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": legal_note
            }
        ],
        format="json",
        think=False,
        options={
            "temperature": 0.1,
            "num_predict": 600
        }
    )

    # Convert AI response to Python dictionary
    result = json.loads(response.message.content)

    print("\n========== ADVOCANOTE AI RESULT ==========")

    print(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2
        )
    )

except Exception as error:
    print("AI Analysis Error:", error)
