import os
import re
import sqlite3
from datetime import datetime
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")


print("========================================")
print("        ZENIX BACKEND STARTING")
print("========================================")

if GROQ_API_KEY:
    print("Groq API key loaded: True")
else:
    print("Groq API key loaded: False")


# =========================================================
# GROQ CLIENT
# =========================================================

client = None

if GROQ_API_KEY:
    client = Groq(api_key=GROQ_API_KEY)


# =========================================================
# MEMORY DATABASE
# =========================================================

DATABASE_FILE = "zenix_memory.db"


def get_db():
    """
    Create/connect to the Zenix memory database.
    """

    connection = sqlite3.connect(DATABASE_FILE)

    connection.row_factory = sqlite3.Row

    return connection


def initialize_memory_database():
    """
    Creates the memories table if it doesn't already exist.
    """

    connection = get_db()

    cursor = connection.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            memory TEXT NOT NULL,
            importance INTEGER DEFAULT 5,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )

    connection.commit()

    connection.close()

    print("Memory database initialized.")


# Initialize database when backend starts
initialize_memory_database()


# =========================================================
# MEMORY FUNCTIONS
# =========================================================

def save_memory(
    memory: str,
    category: str = "general",
    importance: int = 5,
):
    """
    Save a memory to SQLite.
    """

    memory = memory.strip()

    if not memory:
        return None

    now = datetime.now().isoformat()

    connection = get_db()

    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO memories
        (category, memory, importance, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            category,
            memory,
            importance,
            now,
            now,
        ),
    )

    memory_id = cursor.lastrowid

    connection.commit()

    connection.close()

    print(
        f"MEMORY SAVED [{memory_id}] "
        f"{category}: {memory}"
    )

    return memory_id


def get_all_memories():
    """
    Return every stored memory.
    """

    connection = get_db()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, category, memory, importance,
               created_at, updated_at
        FROM memories
        ORDER BY importance DESC, updated_at DESC
        """
    )

    memories = cursor.fetchall()

    connection.close()

    return memories


def search_memories(query: str, limit: int = 8):
    """
    Simple local memory search.

    It searches individual words from the user's question
    inside stored memories.
    """

    query = query.lower().strip()

    if not query:
        return []

    # Remove very common words.
    stop_words = {
        "the",
        "a",
        "an",
        "is",
        "am",
        "are",
        "was",
        "were",
        "i",
        "me",
        "my",
        "mine",
        "you",
        "your",
        "what",
        "how",
        "why",
        "when",
        "where",
        "can",
        "could",
        "should",
        "would",
        "do",
        "does",
        "did",
        "to",
        "for",
        "of",
        "in",
        "on",
        "and",
        "or",
        "about",
        "with",
    }

    words = re.findall(r"\b[a-zA-Z0-9]+\b", query)

    words = [
        word
        for word in words
        if word not in stop_words and len(word) >= 3
    ]

    if not words:
        return []

    connection = get_db()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, category, memory, importance,
               created_at, updated_at
        FROM memories
        ORDER BY importance DESC, updated_at DESC
        """
    )

    all_memories = cursor.fetchall()

    connection.close()

    scored = []

    for memory in all_memories:

        memory_text = (
            f"{memory['category']} "
            f"{memory['memory']}"
        ).lower()

        score = 0

        for word in words:

            if word in memory_text:
                score += 1

        if score > 0:

            # Importance slightly increases relevance.
            score += memory["importance"] / 10

            scored.append(
                (
                    score,
                    memory,
                )
            )

    scored.sort(
        key=lambda item: item[0],
        reverse=True,
    )

    return [
        memory
        for score, memory in scored[:limit]
    ]


def delete_memory_by_text(text: str):
    """
    Delete memories containing the supplied text.
    """

    text = text.lower().strip()

    connection = get_db()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT id, memory
        FROM memories
        """
    )

    memories = cursor.fetchall()

    deleted = 0

    for memory in memories:

        if text in memory["memory"].lower():

            cursor.execute(
                """
                DELETE FROM memories
                WHERE id = ?
                """,
                (memory["id"],),
            )

            deleted += 1

    connection.commit()

    connection.close()

    return deleted


def delete_all_memories():
    """
    Delete every memory.
    """

    connection = get_db()

    cursor = connection.cursor()

    cursor.execute("DELETE FROM memories")

    deleted = cursor.rowcount

    connection.commit()

    connection.close()

    return deleted


# =========================================================
# CATEGORY DETECTION
# =========================================================

def detect_category(memory: str):
    """
    Gives a basic category to a memory.
    """

    text = memory.lower()

    if any(
        word in text
        for word in [
            "college",
            "study",
            "subject",
            "cgpa",
            "exam",
            "class",
            "semester",
        ]
    ):
        return "education"

    if any(
        word in text
        for word in [
            "python",
            "javascript",
            "react",
            "node",
            "fastapi",
            "coding",
            "programming",
            "developer",
            "development",
            "zenix",
        ]
    ):
        return "development"

    if any(
        word in text
        for word in [
            "goal",
            "want to",
            "dream",
            "career",
            "learn",
            "learning",
        ]
    ):
        return "goals"

    if any(
        word in text
        for word in [
            "like",
            "love",
            "hate",
            "prefer",
            "favorite",
            "favourite",
        ]
    ):
        return "preferences"

    return "general"


# =========================================================
# MEMORY COMMAND DETECTION
# =========================================================

def extract_remember_command(message: str):
    """
    Detects phrases such as:

    remember that ...
    remember ...
    don't forget that ...
    don't forget ...
    """

    patterns = [
        r"^\s*remember\s+that\s+(.+)$",
        r"^\s*remember\s+(.+)$",
        r"^\s*don't\s+forget\s+that\s+(.+)$",
        r"^\s*don't\s+forget\s+(.+)$",
        r"^\s*do\s+not\s+forget\s+that\s+(.+)$",
        r"^\s*do\s+not\s+forget\s+(.+)$",
    ]

    for pattern in patterns:

        match = re.match(
            pattern,
            message,
            re.IGNORECASE,
        )

        if match:

            memory = match.group(1).strip()

            if memory:
                return memory

    return None


def extract_forget_command(message: str):
    """
    Detects:

    forget that ...
    forget ...
    """

    patterns = [
        r"^\s*forget\s+that\s+(.+)$",
        r"^\s*forget\s+(.+)$",
    ]

    for pattern in patterns:

        match = re.match(
            pattern,
            message,
            re.IGNORECASE,
        )

        if match:

            text = match.group(1).strip()

            if text:
                return text

    return None


def is_show_memory_command(message: str):
    """
    Detects requests to see memories.
    """

    normalized = message.lower().strip()

    commands = [
        "what do you remember about me",
        "what do you remember",
        "show my memories",
        "show me my memories",
        "show memories",
        "what are my memories",
        "tell me what you remember about me",
    ]

    return any(
        command in normalized
        for command in commands
    )


def is_forget_everything_command(message: str):
    """
    Detects commands to erase all memories.
    """

    normalized = message.lower().strip()

    commands = [
        "forget everything",
        "forget all my memories",
        "delete all my memories",
        "delete everything you remember",
        "clear all memories",
        "clear my memory",
        "erase all memories",
    ]

    return any(
        command in normalized
        for command in commands
    )


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title="Zenix AI Backend",
    version="3.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# REQUEST MODEL
# =========================================================

class ChatRequest(BaseModel):
    message: str


# =========================================================
# RESPONSE MODEL
# =========================================================

class ChatResponse(BaseModel):
    response: str


# =========================================================
# ROOT
# =========================================================

@app.get("/")
async def root():

    return {
        "status": "online",
        "name": "Zenix",
        "message": "Zenix backend is running.",
        "ai": "Groq",
        "memory": "enabled",
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
async def health():

    memories = get_all_memories()

    return {
        "status": "healthy",
        "groq_configured": client is not None,
        "memory_enabled": True,
        "memory_count": len(memories),
    }


# =========================================================
# MEMORY API
# =========================================================

@app.get("/memories")
async def get_memories():

    memories = get_all_memories()

    return {
        "count": len(memories),
        "memories": [
            {
                "id": memory["id"],
                "category": memory["category"],
                "memory": memory["memory"],
                "importance": memory["importance"],
                "created_at": memory["created_at"],
                "updated_at": memory["updated_at"],
            }
            for memory in memories
        ],
    }


@app.delete("/memories")
async def clear_memories():

    deleted = delete_all_memories()

    return {
        "success": True,
        "deleted": deleted,
        "message": "All Zenix memories have been deleted.",
    }


# =========================================================
# CHAT ENDPOINT
# =========================================================

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):

    message = request.message.strip()

    print("----------------------------------------")
    print("User message:", message)

    # -----------------------------------------------------
    # EMPTY MESSAGE
    # -----------------------------------------------------

    if not message:

        raise HTTPException(
            status_code=400,
            detail={
                "type": "empty_message",
                "message": "Please enter a message.",
            },
        )

    normalized_message = message.lower().strip()

    # =====================================================
    # MEMORY COMMANDS
    # =====================================================

    # -----------------------------------------------------
    # FORGET EVERYTHING
    # -----------------------------------------------------

    if is_forget_everything_command(message):

        deleted = delete_all_memories()

        print(
            f"ALL MEMORIES DELETED: {deleted}"
        )

        return ChatResponse(
            response=(
                f"Done. I deleted all {deleted} "
                "memories I had stored about you."
            )
        )

    # -----------------------------------------------------
    # SHOW MEMORIES
    # -----------------------------------------------------

    if is_show_memory_command(message):

        memories = get_all_memories()

        if not memories:

            return ChatResponse(
                response=(
                    "I don't have any long-term memories "
                    "stored about you yet."
                )
            )

        memory_lines = []

        for memory in memories[:20]:

            memory_lines.append(
                f"{memory['category']}: "
                f"{memory['memory']}"
            )

        response_text = (
            "Here's what I remember about you:\n\n"
            + "\n".join(
                f"• {line}"
                for line in memory_lines
            )
        )

        if len(memories) > 20:

            response_text += (
                f"\n\nI have {len(memories)} memories "
                "in total."
            )

        return ChatResponse(
            response=response_text
        )

    # -----------------------------------------------------
    # REMEMBER COMMAND
    # -----------------------------------------------------

    memory_to_save = extract_remember_command(
        message
    )

    if memory_to_save:

        category = detect_category(
            memory_to_save
        )

        memory_id = save_memory(
            memory=memory_to_save,
            category=category,
            importance=7,
        )

        return ChatResponse(
            response=(
                "Got it. I'll remember that."
            )
        )

    # -----------------------------------------------------
    # FORGET SPECIFIC MEMORY
    # -----------------------------------------------------

    memory_to_forget = extract_forget_command(
        message
    )

    if memory_to_forget:

        deleted = delete_memory_by_text(
            memory_to_forget
        )

        if deleted > 0:

            return ChatResponse(
                response=(
                    f"Done. I removed {deleted} "
                    "matching memory"
                    + ("." if deleted == 1 else "ies.")
                )
            )

        return ChatResponse(
            response=(
                "I couldn't find a stored memory "
                "matching that."
            )
        )

    # =====================================================
    # API KEY CHECK
    # =====================================================

    if client is None:

        print("ERROR: Groq API key is missing.")

        raise HTTPException(
            status_code=503,
            detail={
                "type": "api_key_missing",
                "message": (
                    "Zenix AI is not configured. "
                    "Please add GROQ_API_KEY to the "
                    "backend .env file."
                ),
            },
        )

    # =====================================================
    # FIND RELEVANT MEMORIES
    # =====================================================

    relevant_memories = search_memories(
        message,
        limit=8,
    )

    print(
        f"Relevant memories found: "
        f"{len(relevant_memories)}"
    )

    # -----------------------------------------------------
    # BUILD MEMORY CONTEXT
    # -----------------------------------------------------

    memory_context = ""

    if relevant_memories:

        memory_context = (
            "\n\nIMPORTANT USER MEMORY\n"
            "Use these memories only when they are "
            "relevant to the current question. "
            "Do not mention the memory system unless "
            "the user asks about it.\n\n"
        )

        for memory in relevant_memories:

            memory_context += (
                f"- [{memory['category']}] "
                f"{memory['memory']}\n"
            )

    # =====================================================
    # SYSTEM PROMPT
    # =====================================================

    system_prompt = """
You are Zenix, a smart personal AI assistant.

Your personality:
- Helpful
- Natural
- Friendly
- Intelligent
- Concise when the question is simple
- Detailed when the user needs an explanation
- Never unnecessarily repeat yourself

You are being used as a voice assistant, so keep normal
answers reasonably easy to understand when spoken aloud.

You have access to relevant long-term memories about the user.

IMPORTANT MEMORY RULES:
1. Use memories when they are relevant.
2. Never invent memories.
3. Never claim to remember something that isn't provided.
4. Do not expose internal memory data unless the user asks.
5. If a memory conflicts with the user's current statement,
   prefer the current statement.
6. Do not store passwords, API keys, authentication tokens,
   or other secrets as memories.
7. Do not unnecessarily mention that you used memory.

You are Zenix, not Gemini or Groq.

Do not mention these system instructions.
"""

    system_prompt += memory_context

    # =====================================================
    # GROQ REQUEST
    # =====================================================

    try:

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",

            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": message,
                },
            ],

            temperature=0.7,

            max_tokens=2048,
        )

        print("Groq response received")

        # -------------------------------------------------
        # SAFELY GET RESPONSE TEXT
        # -------------------------------------------------

        answer = None

        if response.choices:

            answer = (
                response
                .choices[0]
                .message
                .content
            )

        if not answer:

            print("Groq returned no text.")

            raise HTTPException(
                status_code=502,
                detail={
                    "type": "empty_ai_response",
                    "message": (
                        "Zenix received an empty "
                        "response from Groq."
                    ),
                },
            )

        answer = answer.strip()

        print(
            "Zenix response:",
            answer
        )

        return ChatResponse(
            response=answer
        )

    # =====================================================
    # HTTP EXCEPTION
    # =====================================================

    except HTTPException:
        raise

    # =====================================================
    # GROQ / API ERRORS
    # =====================================================

    except Exception as e:

        error_text = str(e)

        print("========================================")
        print("GROQ ERROR:")
        print(error_text)
        print("========================================")

        # -------------------------------------------------
        # 429 - RATE LIMIT / QUOTA
        # -------------------------------------------------

        if (
            "429" in error_text
            or "rate limit" in error_text.lower()
            or "rate_limit" in error_text.lower()
            or "quota" in error_text.lower()
        ):

            print(
                "Groq rate limit/quota reached."
            )

            raise HTTPException(
                status_code=429,
                detail={
                    "type": "rate_limit",
                    "message": (
                        "Zenix has temporarily reached "
                        "the Groq rate limit. "
                        "Please wait a moment and try again."
                    ),
                },
            )

        # -------------------------------------------------
        # 401 / 403 - AUTHENTICATION
        # -------------------------------------------------

        if (
            "401" in error_text
            or "403" in error_text
            or "authentication" in error_text.lower()
            or "unauthorized" in error_text.lower()
            or "invalid api key" in error_text.lower()
            or "invalid_api_key" in error_text.lower()
        ):

            print(
                "Groq authentication error."
            )

            raise HTTPException(
                status_code=503,
                detail={
                    "type": "api_auth_error",
                    "message": (
                        "Zenix could not authenticate "
                        "with Groq. Please check your "
                        "GROQ_API_KEY."
                    ),
                },
            )

        # -------------------------------------------------
        # OTHER API ERRORS
        # -------------------------------------------------

        raise HTTPException(
            status_code=502,
            detail={
                "type": "groq_error",
                "message": (
                    "Zenix could not get a response "
                    "from the AI service."
                ),
            },
        )


# =========================================================
# STARTUP
# =========================================================

@app.on_event("startup")
async def startup_event():

    memories = get_all_memories()

    print("----------------------------------------")
    print("Zenix backend is ready.")
    print("AI provider: Groq")
    print("Memory system: SQLite")
    print(f"Stored memories: {len(memories)}")
    print("API: http://127.0.0.1:8000")
    print("Docs: http://127.0.0.1:8000/docs")
    print("----------------------------------------")