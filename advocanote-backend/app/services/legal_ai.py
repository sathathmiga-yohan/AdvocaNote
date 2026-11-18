
import json
import re
from ollama import Client

# ==========================================
# ADVOCANOTE - TAMIL LEGAL AI
# Qwen3.5 0.8B via local Ollama
# ==========================================

MODEL_NAME = "qwen3.5:0.8b"

client = Client(
    host="http://127.0.0.1:11434",
    timeout=300,
)


SYSTEM_PROMPT = """
You are AdvocaNote AI, a professional legal diary
assistant for Sri Lankan lawyers.

YOUR PURPOSE:
Understand a lawyer's spoken or typed account
and produce accurate, organized legal diary notes.

Support BOTH Tamil and English equally.

========================================
1. UNDERSTAND NATURAL LANGUAGE
========================================

The lawyer may use:
- Formal or conversational Tamil
- Formal or conversational English
- Mixed Tamil and English
- Incomplete sentences
- Long speech without punctuation
- Informal expressions and different verb forms
- Voice transcription with minor errors
- Manually typed text

Understand the meaning of the FULL account.

Do not depend on fixed words or expressions.
Do not mechanically split every phrase into notes.

Extract every meaningful, understandable legal
fact, professional activity, event and future action.

These may include court work, office work,
case preparation, judgments, arguments,
evidence, hearings, documents, client discussions,
legal research, appeals or other activities.

These are EXAMPLES, not restrictions.

Never omit meaningful information simply
because it is not mentioned in the examples.

========================================
2. PROFESSIONAL LEGAL NOTES
========================================

Organize the account into clear, complete,
natural and professional diary notes.

IMPORTANT:
- Understand the event before summarizing.
- Do not copy entire paragraphs.
- Do not output incomplete sentence fragments.
- Do not split information word by word.
- Combine closely related details where appropriate.
- Keep different legal events separate.
- Preserve every meaningful supported fact.
- Avoid duplicate notes.
- Never change the original meaning.

For example:
A court appearance, evidence submission,
judgment and future hearing are distinct events.

A single source statement may contain multiple
facts and can produce several complete notes.

Multiple notes may use the same source_id.

Each note must be independently understandable.

Each note must be at most 110 characters.
If necessary, use multiple complete notes
rather than cutting a sentence midway.

========================================
3. EXACTLY EIGHT LEGAL CATEGORIES
========================================

Use ONLY the following eight categories.

The category order is STRICTLY FIXED.

TAMIL CATEGORIES:

1. வழக்கு முன்னேற்றம்
2. நீதிமன்ற நடவடிக்கைகள்
3. தீர்ப்புகள் மற்றும் உத்தரவுகள்
4. சாட்சியங்கள் மற்றும் ஆதாரங்கள்
5. சட்டக் குறிப்புகள் மற்றும் வாதங்கள்
6. ஆவணங்கள்
7. வாடிக்கையாளர் தொடர்புகள்
8. பிற சட்ட நடவடிக்கைகள்

ENGLISH CATEGORIES:

1. Case Progress
2. Court Proceedings
3. Judgments and Orders
4. Witnesses and Evidence
5. Legal Notes and Arguments
6. Documents
7. Client Communications
8. Other Legal Activities

CATEGORY MEANINGS:

Case Progress:
Case background, allegations, case status,
updates and significant developments.

Court Proceedings:
Court appearances, hearings, adjournments,
court schedules and upcoming hearing dates.

Judgments and Orders:
Actual judgments, judicial decisions,
convictions, acquittals, orders and
sentences that were imposed.

Witnesses and Evidence:
Witness statements, testimony, medical
reports, exhibits and evidence presented.

Legal Notes and Arguments:
Legal arguments, objections, submissions,
observations and legal research.

Documents:
Documents received, checked, reviewed,
prepared, filed or collected.

Client Communications:
Client meetings, calls, discussions,
instructions and case status updates.

Other Legal Activities:
Any other meaningful professional activity
not belonging to the first seven categories.

CATEGORY RULES:
- Classify by actual meaning, not keywords.
- Every note belongs to exactly one category.
- Use the exact category names above.
- Do not invent a ninth category.
- Keep related notes under the same category.
- Return notes in the exact eight-category order.
- Do not mix unrelated categories.

The eight categories organize information.
They must NEVER restrict information extraction.

========================================
4. EMPTY CATEGORIES
========================================

Some categories may contain no information.

Do not invent facts to fill empty categories.

Do not produce placeholder notes or fake source_ids.

The application will display all eight headings
in their fixed order.

For empty Tamil categories, the application shows:
"இந்தப் பதிவில் தகவல் இல்லை"

For empty English categories, the application shows:
"No information recorded in this entry."

Return only factual notes in the JSON notes array.
The application handles empty-category display.

========================================
5. COURT JUDGMENTS AND LEGAL ACCURACY
========================================

Understand exactly what happened in court.

When a lawyer describes a judgment,
record WHAT the judge actually decided.

Do not write only "Judgment was delivered"
when the actual decision is available.

Distinguish carefully between:

- Allegation and proven guilt
- Request and approved court order
- Conviction and imposed sentence
- Scheduled hearing and completed hearing
- Completed action and pending action
- Legal argument and judicial finding

IMPORTANT:
If an accused person was found guilty,
record the conviction accurately.

Do NOT invent imprisonment or punishment.

If sentencing will happen on another date,
record the future proceeding separately
under Court Proceedings.

Preserve negations and uncertainty.

A statement saying no judgment was delivered
must NEVER become a positive judgment.

Never invent or change names, case numbers,
court names, dates, evidence, legal findings,
court orders, sentences or obligations.

If details are unclear, do not guess them.

========================================
6. AI SUGGESTED TASKS
========================================

Identify future actions the lawyer explicitly
needs, intends or is required to perform.

Understand the meaning of natural future
expressions in both Tamil and English.

Do not depend on exact action words.

Examples:
- Obtain certified judgment documents
- Prepare documents for the next hearing
- Inform a client about the case
- Submit an application
- Attend court when explicitly required
- Complete another stated future activity

These examples do NOT limit task types.

TASK RULES:
- Extract only genuine pending actions.
- Do not create tasks from completed activities.
- Do not invent additional duties.
- A hearing date alone is not a task.
- An explicit requirement to attend court
  may be a suggested task.
- Separate distinct future actions.
- Each task must be at most 90 characters.
- Return [] when no valid tasks exist.

All tasks are suggestions requiring
the lawyer's approval.

Do not assume any task has been saved.

========================================
7. CRITICAL HIGHLIGHTS
========================================

Identify only significant legal events.

Examples:
- Important court judgments
- Convictions or acquittals
- Actual sentencing decisions
- Significant court orders
- Major case developments
- Important legal deadlines
- Significant upcoming court proceedings

A highlight about a judgment should explain
the actual decision.

Ordinary office work, routine client meetings
and document collection are not normally
critical highlights.

Do not mark a future personal task
as a critical court event.

Do not invent highlights.

Each highlight must be at most 90 characters.

Return [] if no significant event exists.

========================================
8. TAMIL AND ENGLISH LANGUAGE SUPPORT
========================================

Support Tamil and English equally.

The input language and requested output language
may be different.

Follow the REQUESTED OUTPUT LANGUAGE.

IF OUTPUT LANGUAGE IS TAMIL:
- Use all eight exact Tamil category names.
- Write notes in clear, natural Tamil.
- Write tasks and highlights in Tamil.
- Use complete professional Tamil sentences.

IF OUTPUT LANGUAGE IS ENGLISH:
- Use all eight exact English category names.
- Write notes in clear professional English.
- Write tasks and highlights in English.
- Use complete professional English sentences.

Translate faithfully when input and output
languages are different.

Preserve all legal facts, names, case numbers,
dates, negations and court decisions.

Never invent information during translation.

Use the same eight-category order
for both Tamil and English.

========================================
9. SOURCE VERIFICATION
========================================

Every note, task and highlight must reference
the correct numbered source statement.

Use source_ids exactly as provided.

Never invent source_ids.

Several facts from one source statement
may share the same source_id.

Do not include unsupported information.

Preserve who performed each action
and whether it is past, present or future.

========================================
10. REQUIRED JSON OUTPUT
========================================

Return ONLY valid JSON in this exact structure:

{
  "notes": [
    {
      "source_ids": [1],
      "category": "Exact category name",
      "point": "Complete factual legal note"
    }
  ],
  "tasks": [
    {
      "source_ids": [2],
      "point": "Explicit future action"
    }
  ],
  "highlights": [
    {
      "source_ids": [3],
      "point": "Significant legal event"
    }
  ]
}

Return notes grouped in the fixed
eight-category order.

Use [] for sections without valid items.

Do not generate placeholder notes.
Do not add extra fields.
Do not include markdown or explanations.

FINAL CHECK:
- All supported meaningful facts are covered.
- Every note is a complete meaningful sentence.
- Related details are organized coherently.
- The eight categories are correctly selected.
- Notes follow the fixed category order.
- Judgments are represented accurately.
- Convictions and sentences are distinguished.
- Future tasks are separated from completed work.
- Dates and case numbers are preserved.
- No information has been invented.

Return concise, accurate professional
legal diary information.
"""


LANGUAGE_INSTRUCTIONS = {
    "ta": (
        "Write ALL categories, notes, tasks and highlights in natural "
        "Tamil script. If the transcript is English, translate accurately "
        "without adding or changing any facts, names, dates or duties."
    ),
    "en": (
        "Write ALL categories, notes, tasks and highlights in clear "
        "English. If the transcript is Tamil, translate accurately "
        "without adding or changing any facts, names, dates or duties."
    ),
}


# ==========================================
# VALIDATION PATTERNS
# ==========================================

TAMIL = re.compile(r"[\u0B80-\u0BFF]")

NUMBERS = re.compile(r"\d+")

MONTHS = re.compile(
    r"\b(?:January|February|March|April|May|June|July|August|"
    r"September|October|November|December|Jan|Feb|Mar|Apr|Jun|"
    r"Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b|"
    r"ஜனவரி|பிப்ரவரி|மார்ச்|ஏப்ரல்|மே|ஜூன்|ஜூலை|"
    r"ஆகஸ்ட்|செப்டம்பர்|அக்டோபர்|நவம்பர்|டிசம்பர்",
    re.IGNORECASE,
)

ROLES = re.compile(
    r"\b(?:plaintiffs?|defendants?|petitioners?|respondents?)\b|"
    r"மனுதாரர்|எதிர்மனுதாரர்",
    re.IGNORECASE,
)


# ==========================================
# TAMIL / ENGLISH VALIDATION
# ==========================================

MONTH_ALIASES = {
    1: ("January", "Jan", "ஜனவரி"),
    2: ("February", "Feb", "பிப்ரவரி"),
    3: ("March", "Mar", "மார்ச்"),
    4: ("April", "Apr", "ஏப்ரல்"),
    5: ("May", "மே"),
    6: ("June", "Jun", "ஜூன்"),
    7: ("July", "Jul", "ஜூலை"),
    8: ("August", "Aug", "ஆகஸ்ட்"),
    9: ("September", "Sep", "Sept", "செப்டம்பர்"),
    10: ("October", "Oct", "அக்டோபர்"),
    11: ("November", "Nov", "நவம்பர்"),
    12: ("December", "Dec", "டிசம்பர்"),
}

MONTH_INDEX = {
    alias.casefold(): month
    for month, aliases in MONTH_ALIASES.items()
    for alias in aliases
}

ROLE_INDEX = {
    "மனுதாரர்": "petitioner",
    "எதிர்மனுதாரர்": "respondent",
    "petitioner": "petitioner",
    "petitioners": "petitioner",
    "respondent": "respondent",
    "respondents": "respondent",
    "plaintiff": "plaintiff",
    "plaintiffs": "plaintiff",
    "defendant": "defendant",
    "defendants": "defendant",
}


def source_language(value):
    return "ta" if TAMIL.search(value or "") else "en"


def target_language_matches(value, language):
    if language == "ta":
        return bool(TAMIL.search(value))

    return not bool(TAMIL.search(value))


def verified_months(value):
    return {
        MONTH_INDEX[match.group().casefold()]
        for match in MONTHS.finditer(value)
        if match.group().casefold() in MONTH_INDEX
    }


def verified_roles(value):
    return {
        ROLE_INDEX[match.group().casefold()]
        for match in ROLES.finditer(value)
        if match.group().casefold() in ROLE_INDEX
    }


TASK_CUE = re.compile(
    r"\b(?:must|should|need\s+to|needs\s+to|have\s+to|has\s+to|"
    r"required\s+to|ordered\s+to|instructed\s+to)\b|"
    r"வேண்டும்|வேணும்|செய்யணும்|பண்ணணும்|செய்யவுள்ளேன்|"
    r"சமர்ப்பிக்க\s*(?:சொன்ன|உத்தரவ)|தாக்கல்\s*செய்ய|தொடர்பு\s*கொள்ள",
    re.IGNORECASE,
)

TASK_ACTION = re.compile(
    r"சமர்ப்பிக்க|தாக்கல்|தயார்|தொடர்பு|அறிவிக்க|"
    r"பெற்றுக்கொள்ள|கொண்டு\s*வர|submit|file|prepare|contact|inform|produce",
    re.IGNORECASE,
)

TASK_NEGATION = re.compile(
    r"வேண்டாம்|தேவையில்லை|அவசியமில்லை|not\s+required|"
    r"need\s+not|do\s+not\s+need",
    re.IGNORECASE,
)

IMPORTANT_CUE = re.compile(
    r"நீதிபதி|உத்தரவ|தீர்ப்ப|தண்டனை|சிறை|விசாரணை|"
    r"அவகாச|ஆட்சேப|எதிர்தரப்ப|சாட்ச|ஆவண|பிணை|"
    r"judg|sentenc|imprison|hearing|order|ruling|"
    r"objection|deadline|bail|witness|evidence",
    re.IGNORECASE,
)


TOPIC_START = re.compile(
    r"\s+(?=(?:"
    r"both\s+parties\b|"
    r"the\s+judge\b|"
    r"the\s+court\b|"
    r"(?:the\s+next\s+hearing|(?<!the\s)next\s+hearing)"
    r"\s+(?:is|was|will|has)\b|"
    r"I\s+(?:need\s+to|must|have\s+to)\b|"
    r"we\s+(?:need\s+to|must|have\s+to)\b|"
    r"opposing\s+counsel\b|"
    r"however\b|"
    r"after\s+that\b|"
    r"நீதிபதி|"
    r"நீதிமன்றம்|"
    r"இரு\s*தரப்பின|"
    r"எதிர்த்தரப்ப|"
    r"எதிர்தரப்ப|"
    r"அடுத்த\s+விசாரணை|"
    r"வாடிக்கையாளரைத்\s*தொடர்பு|"
    r"மேலும்|"
    r"அதன்பிறகு"
    r"))",
    re.IGNORECASE,
)

BREAK_WORDS = re.compile(
    r"\s*(?:[,;]|\s+ஆனால்\s+|\s+அதன்பிறகு\s+|"
    r"\s+பிறகு\s+|\s+பின்னர்\s+|\s+அப்புறம்\s+|\s+மேலும்\s+)\s*"
)

# ==========================================
# NORMALIZE TEXT
# ==========================================

def normalize(value):
    return re.sub(
        r"\s+",
        " ",
        str(value or ""),
    ).strip()



def split_statements(transcript):
    text = normalize(transcript)

    # Split natural Tamil speech even when
    # the browser adds no full stops.
    tamil_boundary = re.compile(
        r"(?P<ending>[\u0B80-\u0BFF]{2,}(?:"
        r"னேன்|த்தேன்|ட்டேன்|தேன்|"
        r"னோம்|த்தோம்|"
        r"னார்|த்தார்|ட்டார்|ப்பட்டார்|"
        r"னார்கள்|த்தார்கள்|ட்டார்கள்|"
        r"ப்பட்டனர்|ப்பட்டன|த்தனர்|"
        r"ந்தது|த்தது|ட்டது|ப்பட்டது|"
        r"கிறது|கின்றது|வில்லை|வேண்டும்|"
        r"உள்ளேன்|உள்ளது|உள்ளனர்|"
        r"கொண்டார்|கொண்டேன்|"
        r"திட்டமிட்டுள்ளேன்"
        r"))\s+(?=(?:"
        r"இன்று|நேற்று|நாளை|மறுநாள்|"
        r"நான்|நாங்கள்|அவர்|அவர்கள்|"
        r"அந்த|இந்த|ஒரு|இரு|"
        r"எதிர்த்தரப்பு|எதிர்தரப்பு|"
        r"மனுதாரர்|நீதிபதி|நீதிமன்ற|"
        r"வழக்கு|விசாரணை|அடுத்த|"
        r"பின்னர்|அப்போது|மேலும்|"
        r"வாடிக்கையாளர்|என்று|"
        r"தீர்ப்பின்|சாட்சி|குற்ற|தண்டனை"
        r")(?:\s|$))"
    )

    text = tamil_boundary.sub(
        lambda match: match.group("ending") + ". ",
        text,
    )

    # Keep existing English and court-related
    # statement splitting.
    text = TOPIC_START.sub(
        ". ",
        text,
    )

    sentences = re.split(
        r"(?<=[.!?।])\s+|\s*;\s*",
        text,
    )

    result = []

    for sentence in sentences:
        sentence = sentence.strip(" .;\t")

        if not sentence:
            continue

        pieces = (
            BREAK_WORDS.split(sentence)
            if len(sentence) > 150
            else [sentence]
        )

        for piece in pieces:
            piece = piece.strip(" .;")

            if piece:
                result.append(piece)
    print("[ADVOCANOTE SPLIT RESULT]", result)
    return result


# ==========================================
# LONG TRANSCRIPT CHUNKING
# ==========================================

def chunk_statements(
    statements,
    max_chars=1050,
    max_items=7,
):
    chunks = []
    batch = []
    size = 0

    for statement in statements:
        words = statement.split()
        parts = []
        part = ""

        for word in words:
            if (
                part
                and len(part) + len(word) + 1 > max_chars
            ):
                parts.append(part)
                part = ""

            part = (
                part + " " + word
            ).strip()

        if part:
            parts.append(part)

        for piece in parts:
            if batch and (
                size + len(piece) > max_chars
                or len(batch) >= max_items
            ):
                chunks.append(batch)
                batch = []
                size = 0

            batch.append(piece)
            size += len(piece)

    if batch:
        chunks.append(batch)

    return chunks


# ==========================================
# VERIFY SOURCE IDS
# ==========================================

def valid_ids(values, count):
    ids = []

    if not isinstance(values, list):
        return ids

    for value in values:
        if (
            isinstance(value, str)
            and value.strip().isdigit()
        ):
            value = int(value.strip())

        if (
            type(value) is int
            and 1 <= value <= count
            and value not in ids
        ):
            ids.append(value)

    return ids


# ==========================================
# VERIFY AI FACTS
# ==========================================

def safe_ai_point(item, batch, kind, language):
    if not isinstance(item, dict):
        return None

    ids = valid_ids(
        item.get("source_ids"),
        len(batch),
    )

    point = normalize(
        item.get("point")
    ).strip("-• ")

    max_length = (
        110
        if kind in {"task", "highlight"}
        else 150
    )

    if (
        not ids
        or not point
        or len(point) > max_length
    ):
        return None

    # One source statement per legal note.
    # Avoid losing other activities.
    if kind == "note" and len(ids) != 1:
        return None        

    evidence = " ".join(
        batch[index - 1]
        for index in ids
    )

    # Check selected output language.
    if not target_language_matches(point, language):
        return None

    cross_language = (
        source_language(evidence) != language
    )

    # Reject invented numeric facts.
    if not set(
        NUMBERS.findall(point)
    ).issubset(
        set(NUMBERS.findall(evidence))
    ):
        return None

    # Validate translated month names.
    if not verified_months(point).issubset(
        verified_months(evidence)
    ):
        return None

    # Validate translated party roles.
    if not verified_roles(point).issubset(
        verified_roles(evidence)
    ):
        return None

    # Tasks need an actual source instruction.
    if kind == "task" and (
        not TASK_CUE.search(evidence)
        or TASK_NEGATION.search(evidence)
    ):
        return None

    point_words = re.findall(
        r"[\u0B80-\u0BFF]{3,}|[A-Za-z]{4,}",
        point,
    )

    source_words = re.findall(
        r"[\u0B80-\u0BFF]{3,}|[A-Za-z]{4,}",
        evidence,
    )

    # Word overlap is meaningful when
    # source and output use the same language.
    if point_words and not cross_language:
        shared = sum(
            any(
                word.casefold() == source_word.casefold()
                or (
                    min(
                        len(word),
                        len(source_word),
                    ) >= 5
                    and (
                        word.casefold()
                        in source_word.casefold()
                        or source_word.casefold()
                        in word.casefold()
                    )
                )
                for source_word in source_words
            )
            for word in point_words
        )

        minimum = (
            1
            if len(point_words) <= 2
            else max(
                2,
                (len(point_words) * 2 + 2) // 3,
            )
        )

        if shared < minimum:
            return None

    return point, ids


# ==========================================
# ORIGINAL SOURCE POINT
# ==========================================

def source_point(sentence):
    text = normalize(sentence).strip(" .;,-")

    text = re.sub(
        r"^(?:அதாவது|என்னன்னா|என்னவென்றால்|அப்போ|சரி)\s+",
        "",
        text,
    )

    return re.sub(
        r"^(?:so|basically|well|okay)\s+",
        "",
        text,
        flags=re.IGNORECASE,
    )


# ==========================================
# SHORTEN OTHER LEGAL NOTES
# FIXED: TOP-LEVEL FUNCTION
# ==========================================

def shorten_other_point(sentence):
    text = source_point(sentence)

    rules = [
        (
            r"^(?:அதாவது|என்னன்னா|என்னவென்றால்|சரி|ஓகே)\s+",
            "",
        ),
        (
            r"இந்த வழக்கை பொருத்தவரையில்",
            "வழக்கில்",
        ),
        (
            r"இந்த வழக்கை பொறுத்தவரை",
            "வழக்கில்",
        ),
        (
            r"வழக்கு சம்பந்தமாக",
            "வழக்கில்",
        ),
        (
            r"அந்த நேரத்தில்",
            "அப்போது",
        ),
        (
            r"அந்த சமயத்தில்",
            "அப்போது",
        ),
        (
            r"கூடுதல் கால அவகாசம்",
            "கூடுதல் அவகாசம்",
        ),
        (
            r"அவர்களுடைய தரப்பிலிருந்து",
            "அவர்கள் தரப்பில்",
        ),
        (
            r"அடுத்த முறை விசாரணைக்கு வரும்போது",
            "அடுத்த விசாரணையில்",
        ),
        (
            r"^(?:basically|actually)\s+",
            "",
        ),
    ]

    for pattern, replacement in rules:
        text = re.sub(
            pattern,
            replacement,
            text,
            flags=re.IGNORECASE,
        )

    return normalize(text).strip(" .;")


# ==========================================
# EXTRACT SHORT TASKS FROM SOURCE
# ==========================================


def extract_source_tasks(statement):
    source = source_point(statement)

    # Extract only pending actions.
    if (
        not TASK_CUE.search(source)
        or TASK_NEGATION.search(source)
    ):
        return []

    if TAMIL.search(source):
        # Separate multiple actions.
        clauses = re.split(
            r"\s*[,;]\s*",
            source,
        )

        results = []

        for clause in clauses:
            clause = re.sub(
                r"^(?:அதற்கு\s+முன்னதாக|"
                r"அதற்கு\s+பிறகு|பின்னர்)\s+",
                "",
                clause,
            ).strip(" .;,:")

            clause = re.sub(
                r"^நான்\s+",
                "",
                clause,
            )

            if not clause:
                continue

            # Linked Tamil actions can share
            # a final future obligation.

            if (
                len(clauses) > 1
                and clause.endswith("க்கொண்டு")
            ):
                clause = (
                    clause[:-len("க்கொண்டு")]
                    + "க்கொள்ள வேண்டும்"
                )

            elif (
                len(clauses) > 1
                and clause.endswith("கொண்டு")
            ):
                clause = (
                    clause[:-len("கொண்டு")]
                    + "கொள்ள வேண்டும்"
                )

            elif not TASK_CUE.search(clause):
                continue

            if 5 <= len(clause) <= 120:
                results.append(clause)

        return list(dict.fromkeys(results))


    # English tasks: remove "I need to" etc.
    cleaned = re.sub(
        r"^(?:(?:I|we|our team)\s+)?"
        r"(?:need\s+to|must|should|have\s+to|"
        r"plan\s+to|will)\s+",
        "",
        source,
        flags=re.IGNORECASE,
    )

    # Separate actions such as:
    # "contact my client and prepare documents"
    parts = re.split(
        r"\s+and\s+(?="
        r"(?:contact|connect|prepare|file|submit|"
        r"inform|produce|draft|obtain|collect|"
        r"send|review|meet|provide|gather)\b)",
        cleaned,
        flags=re.IGNORECASE,
    )

    results = []

    for part in parts:
        part = source_point(part)

        if not (
            4 <= len(part) <= 115
            and TASK_ACTION.search(part)
        ):
            continue

        # Do not mistake a court result for a task.
        if re.search(
            r"\b(?:judge|next\s+hearing|"
            r"granted\s+additional\s+time)\b",
            part,
            re.IGNORECASE,
        ):
            continue

        results.append(
            part[0].upper() + part[1:]
        )

    return results

# ==========================================
# LEGAL POINT CATEGORIES
# ==========================================

def source_category(text, language=None):
    """
    Classify each legal note into one of
    the eight AdvocaNote main categories.
    """

    text = normalize(text)

    is_tamil = (
        language == "ta"
        if language in {"ta", "en"}
        else bool(TAMIL.search(text))
    )

    groups = {
        "progress": (
            "வழக்கு முன்னேற்றம்",
            "Case Progress",
        ),
        "court": (
            "நீதிமன்ற நடவடிக்கைகள்",
            "Court Proceedings",
        ),
        "decision": (
            "தீர்ப்புகள் மற்றும் உத்தரவுகள்",
            "Judgments and Orders",
        ),
        "evidence": (
            "சாட்சியங்கள் மற்றும் ஆதாரங்கள்",
            "Witnesses and Evidence",
        ),
        "arguments": (
            "சட்டக் குறிப்புகள் மற்றும் வாதங்கள்",
            "Legal Notes and Arguments",
        ),
        "documents": (
            "ஆவணங்கள்",
            "Documents",
        ),
        "clients": (
            "வாடிக்கையாளர் தொடர்புகள்",
            "Client Communications",
        ),
        "other": (
            "பிற சட்ட நடவடிக்கைகள்",
            "Other Legal Activities",
        ),
    }

    # Classify using the actual note text.
    # Specific activities come before general ones.

    patterns = [
        (
            r"வாடிக்கையாள|கட்சிக்கார|"
            r"\bclient\b|\bcustomer\b",
            "clients",
        ),
        (
            r"சாட்சிய|சாட்சிகள|சாட்சி|ஆதார|"
            r"\bwitness(?:es)?\b|"
            r"\bevidence\b|\bexhibit(?:s)?\b",
            "evidence",
        ),
        (
            r"ஆவண|கோப்புகள|கோப்பின|"
            r"கோப்பை|கோப்புகளை|"
            r"சான்றளிக்கப்பட்ட\s+நகல்|நகலை|"
            r"\bdocument(?:s)?\b|"
            r"\bcase\s+file(?:s)?\b|"
            r"\bcertified\s+cop(?:y|ies)\b|"
            r"\bfiling\b|\baffidavit\b",
            "documents",
        ),
        (
            r"அடுத்த\s+விசாரணை|"
            r"மறு\s*விசாரணை|"
            r"ஒத்திவைக்க|ஆஜர|"
            r"நீதிமன்றத்திற்கு\s*செல்ல|"
            r"\bnext\s+hearing\b|"
            r"\badjourn(?:ed|ment)?\b|"
            r"\bappear(?:ed|ing)?\s+"
            r"(?:in|before|at)\s+court\b|"
            r"\battend(?:ed|ing)?\s+"
            r"(?:the\s+)?(?:court|hearing)\b",
            "court",
        ),
        (
            r"தீர்ப்ப|உத்தரவ|"
            r"குற்றவாளியாக|குற்றவாளி\s+என|"
            r"விடுதலை\s+செய்|"
            r"தண்டனை\s+விதி|சிறைத்தண்டனை|"
            r"பிணை\s+(?:வழங்க|மறுக்க)|"
            r"அவகாசம்\s+வழங்க|"
            r"\bjudg(?:e)?ment\b|\bverdict\b|"
            r"\bcourt\s+order\b|"
            r"\bconvict(?:ed|ion)?\b|"
            r"\bacquit(?:ted|tal)?\b|"
            r"\bsentenc(?:ed|ing|e)\b|"
            r"\bbail\s+(?:granted|denied)\b",
            "decision",
        ),
        (
            r"வாத|ஆட்சேப|"
            r"எதிர்ப்பு\s+தெரிவி|"
            r"சட்டப்பிரிவு|சட்ட\s+கருத்து|"
            r"சட்டக்\s*குறிப்பு|"
            r"\bargument(?:s)?\b|"
            r"\bobjection(?:s)?\b|"
            r"\bsubmission(?:s)?\b|"
            r"\blegal\s+"
            r"(?:opinion|provision|analysis)\b",
            "arguments",
        ),
        (
            r"நீதிமன்ற|விசாரணை|"
            r"விசாரிக்க|விசாரிக்கப்பட்ட|"
            r"\bcourt\b|\bhearing\b|"
            r"\btrial\b|\bproceedings\b",
            "court",
        ),
        (
            r"வழக்க|குற்றச்சாட்ட|புகார்|"
            r"\bcase\b|\bcharge(?:s)?\b|"
            r"\bcomplaint\b",
            "progress",
        ),
    ]

    group = "other"

    for pattern, candidate in patterns:
        if re.search(
            pattern,
            text,
            re.IGNORECASE,
        ):
            group = candidate
            break

    return groups[group][
        0 if is_tamil else 1
    ]


# ==========================================
# QWEN MODEL CALL
# THINKING DISABLED
# ==========================================

def ask_qwen(batch, language):
    numbered = "\n".join(
        f"{index}. {statement}"
        for index, statement in enumerate(
            batch,
            start=1,
        )
    )

    response = client.chat(
        model=MODEL_NAME,
        messages=[
            {
                "role": "system",
                "content": (
                    SYSTEM_PROMPT
                    + "\n"
                    + LANGUAGE_INSTRUCTIONS[language]
                ),
            },
            {
                "role": "user",
                "content": numbered,
            },
        ],
        format="json",
        think=False,
        keep_alive="10m",
        options={
            "temperature": 0,
            "num_ctx": 4096,
            "num_predict": 1000,
        },
    )

    raw = response.message.content or "{}"

    data = json.loads(raw)

    if not isinstance(data, dict):
        raise ValueError(
            "AI response was not a JSON object"
        )

    return data


# ==========================================
# MAIN LEGAL AI ANALYSIS
# ==========================================

def analyze_legal_transcript(
    transcript,
    language="auto",
):
    original = normalize(transcript)

    if not original:
        raise ValueError(
            "Transcript cannot be empty."
        )

    if len(original) > 20000:
        raise ValueError(
            "Transcript exceeds the 20,000 character limit."
        )

    if language not in {"auto", "ta", "en"}:
        raise ValueError(
             "Language must be auto, ta or en."
    )

    output_language = (
        source_language(original)
        if language == "auto"
        else language
    )

    notes = []
    tasks = []
    highlights = []

    seen_notes = set()
    seen_tasks = set()
    seen_highlights = set()

    analysis_incomplete = False

    # =====================================
    # REMOVE DUPLICATE RESULTS
    # =====================================

    def add_unique(
        value,
        collection,
        seen,
        category=None,
    ):
        key = re.sub(
            r"[\W_]+",
            "",
            value.casefold(),
        )

        if not key or key in seen:
            return

        seen.add(key)

        if category is not None:
            collection.append({
                "category": category,
                "point": value,
            })
        else:
            collection.append(value)

    # =====================================
    # SPLIT TRANSCRIPT
    # =====================================

    statements = split_statements(original)

    batches = chunk_statements(statements)

    # =====================================
    # PROCESS EACH BATCH
    # =====================================

    for batch in batches:
        covered = set()
        covered_tasks = set()

        try:
            data = ask_qwen(batch, output_language)
            print(
                "[ADVOCANOTE QWEN RESULT]",
                json.dumps(
                    data,
                    ensure_ascii=False,
                    indent=2,
                ),
                flush=True,
            )
        except Exception as exc:
            print(
                "[AdvocaNote] Qwen analysis failed:",
                repr(exc),
            )

            data = {}
            analysis_incomplete = True

        # =================================
        # AI LEGAL NOTES
        # =================================

        raw_notes = data.get(
            "notes",
            [],
        )

        if isinstance(raw_notes, list):
            for item in raw_notes:
                checked = safe_ai_point(
                    item,
                    batch,
                    "note",
                    output_language,
                )


                if not checked:
                    print(
                        "[ADVOCANOTE NOTE REJECTED]",
                        repr(item),
                        flush=True,
                    )
                    analysis_incomplete = True
                    continue


                point, ids = checked

                # Classify each note into one of
                # the 8 AdvocaNote main categories.

                category = source_category(
                    point,
                    language=output_language,
                )

                add_unique(
                    point,
                    notes,
                    seen_notes,
                    category,
                )

                covered.update(ids)


            for index, statement in enumerate(
                batch,
                start=1,
            ):
                # AI already covered this statement.
                # Do not add the same source again.
                if index in covered:
                    continue

                if source_language(statement) != output_language:
                    analysis_incomplete = True
                    continue

                point = source_point(statement)

                if not point:
                    continue

                # Do not copy long paragraphs as legal notes.
                if len(point) > 150:
                    analysis_incomplete = True
                    continue

                category = source_category(
                    point,
                    language=output_language,
                )

                if category in {
                    "முக்கிய சட்டக் குறிப்பு",
                    "Important Legal Point",
                }:
                    point = shorten_other_point(point)

                add_unique(
                    point,
                    notes,
                    seen_notes,
                    category,
                )

                analysis_incomplete = True


        # =================================
        # AI SUGGESTED TASKS
        # =================================

        raw_tasks = data.get(
            "tasks",
            [],
        )

        if isinstance(raw_tasks, list):
            for item in raw_tasks:
                checked = safe_ai_point(
                    item,
                    batch,
                    "task",
                    output_language,
                )

                if checked:
                    point, ids = checked

                    add_unique(
                        point,
                        tasks,
                        seen_tasks,
                    )

                    covered_tasks.update(ids)

        # =================================
        # EXPLICIT TASK FALLBACK
        # =================================


        for index, statement in enumerate(
            batch,
            start=1,
        ):
            extracted_tasks = extract_source_tasks(
                statement
            )

            if not extracted_tasks:
                continue

            # If a source contains multiple explicit
            # actions, include each action separately.
            # For a single action, only use fallback
            # when AI has not already covered it.
            if (
                index in covered_tasks
                and len(extracted_tasks) == 1
            ):
                continue

            for extracted_task in extracted_tasks:
                add_unique(
                    extracted_task,
                    tasks,
                    seen_tasks,
                )


        # =================================
        # AI CRITICAL HIGHLIGHTS
        # =================================

        raw_highlights = data.get(
            "highlights",
            [],
        )

        if isinstance(raw_highlights, list):
            for item in raw_highlights:
                checked = safe_ai_point(
                    item,
                    batch,
                    "highlight",
                    output_language,
                )


                if checked:
                    point, ids = checked

                    evidence = " ".join(
                        batch[index - 1]
                        for index in ids
                    )

                    # Only important legal events
                    important_event = re.search(
                        r"தீர்ப்ப|குற்றவாளி|விடுதலை|தண்டனை|"
                        r"உத்தரவ|ஒத்திவை|அடுத்த\s+விசாரணை|"
                        r"கால\s*அவகாசம்\s*வழங்க|"
                        r"பிணை\s*வழங்க|பிணை\s*மறுக்க|"
                        r"judgment|verdict|convict|acquit|"
                        r"sentenc|court\s+ordered|"
                        r"court\s+granted|next\s+hearing|"
                        r"adjourn|bail\s+granted|bail\s+denied",
                        evidence,
                        re.IGNORECASE,
                    )

                    if not important_event:
                        continue

                    add_unique(
                        point,
                        highlights,
                        seen_highlights,
                    )


        # =================================
        # COURT HIGHLIGHTS FALLBACK
        # =================================


        for statement in batch:
            if (
                IMPORTANT_CUE.search(statement)
                and source_language(statement) == output_language
                and re.search(
                    r"உத்தரவ|வழங்கினார்|தீர்ப்ப|தண்டனை|சிறை|"
                    r"அடுத்த\s+விசாரணை|"
                    r"court\s+(?:ordered|granted)|"
                    r"judgment|sentence|next\s+hearing",
                    statement,
                    re.IGNORECASE,
                )
            ):
                highlight = source_point(statement)

                if len(highlight) <= 110:
                    add_unique(
                        highlight,
                        highlights,
                        seen_highlights,
                    )


    # =====================================
    # RETURN FRONTEND-COMPATIBLE RESPONSE
    # =====================================

    return {
        "notes": notes,
        "critical_highlights": highlights,
        "suggested_tasks": tasks,
        "ai_suggested_followups": [],
        "requires_approval": True,
        "analysis_incomplete": analysis_incomplete,
    }


# ==========================================
# LOCAL TEST
# ==========================================

if __name__ == "__main__":
    sample = (
        "இன்று மாவட்ட நீதிமன்றத்தில் வழக்கு விசாரணைக்கு எடுத்துக்கொள்ளப்பட்டது. "
        "மனுதாரர் மற்றும் எதிர்மனுதாரர் சார்பில் வழக்கறிஞர்கள் ஆஜரானார்கள். "
        "எங்கள் தரப்பில் மூன்று முக்கிய ஆவணங்கள் சமர்ப்பிக்கப்பட்டன. "
        "நீதிபதி கூடுதல் கால அவகாசம் வழங்கினார். "
        "அடுத்த விசாரணை டிசம்பர் 18ஆம் தேதிக்கு ஒத்திவைக்கப்பட்டது. "
        "வாடிக்கையாளரைத் தொடர்புகொண்டு ஆவணங்களைப் பெற்றுக்கொள்ள வேண்டும்."
    )

    print(
        json.dumps(
            analyze_legal_transcript(sample),
            ensure_ascii=False,
            indent=2,
        )
    )
