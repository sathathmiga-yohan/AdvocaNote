# Qwen, Ollama and AI provider comparisons — Full Answers

Grok, Gemini, OpenRouter மற்றும் Pollinations AI active AdvocaNote inference path-ல் கண்டுபிடிக்கப்படவில்லை. Comparison answers general theory. Qwen/Ollama details local source-ல் trace செய்யப்பட்டவை.

<a id="question-048"></a>

### QUESTION 048 — How did you integrate Grok? How do you manage its API key, response format and usage limits?

**Sister’s original ID S-K01.**

**COMPLETE ANSWER (English):**

Grok is an external model family that can be consumed through a provider API. An external integration typically keeps credentials on the backend, sets timeouts and request limits, validates structured output and avoids sending sensitive source material unnecessarily. The exact vendor API and pricing would require current official documentation. Grok is not implemented in AdvocaNote's inspected legal-analysis path.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Grok API use பண்ணிருந்தா backend-ல credential வைத்திருப்போம். நம்ம project-ல legal note analysis Qwen-ஐ Ollama மூலமா call பண்ணுது.

**HOW IT WORKS IN ADVOCANOTE:**

legal_ai.py creates an Ollama Client pointed at loopback. ask_qwen calls the configured model with system and user messages, JSON format and decoding options. This is the real example for connection limits, schema validation and tenant privacy.

**ACTUAL CODE CONNECTION:**

- [app/services/legal_ai.py, line 11](../../advocanote-backend/app/services/legal_ai.py#L11)
- [app/services/legal_ai.py, line 1195](../../advocanote-backend/app/services/legal_ai.py#L1195)
- [app/services/legal_ai.py, line 1232](../../advocanote-backend/app/services/legal_ai.py#L1232)

**WHY IS IT USED?**

A managed provider can offer remote serving and capacity but adds external data transfer, credential, quota and policy requirements. Local serving avoids provider API credentials on this path, while requiring local runtime resources.

**POSSIBLE ERRORS AND DEBUGGING:**

Verify which client is imported, where requests are sent and which model is selected. Test malformed responses in isolated mocks. Do not print credential values or legal source text.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I did not integrate Grok. AdvocaNote uses Qwen through the Ollama Python client. I still apply the same integration principles: keep access server-side, set an upstream timeout, validate JSON and verify generated claims against source text.”

**FOLLOW-UP QUESTION 1:**

Does local inference make credentials irrelevant everywhere?

**FOLLOW-UP ANSWER 1:**

No. Other app integrations still need secrets and an exposed Ollama service needs network protection.

**FOLLOW-UP QUESTION 2:**

How would an external provider's rate limit differ from local saturation?

**FOLLOW-UP ANSWER 2:**

A provider may return quotas such as 429; local inference may exhaust worker or hardware capacity. Both need bounded retries and backpressure.

---

<a id="question-049"></a>

### QUESTION 049 — How did you install and run Qwen locally? What hardware did you need? Did you fine-tune it or use the pretrained model?

**Sister’s original ID S-K02.**

**COMPLETE ANSWER (English):**

A local LLM deployment needs a runner, a compatible model artifact and a reachable serving interface. Inference uses existing model weights to generate output. Fine-tuning changes weights through training. Required compute depends on model size, quantization, context length, disk/cache, concurrency and target latency. Source inspection cannot certify the developer's installation history or measured hardware.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Ollama model-ஐ run பண்ணும் service. Python app அதுக்கு text அனுப்புது. Model-க்கு prompt கொடுப்பதும் model weights train பண்ணுவதும் வேற விஷயம்.

**HOW IT WORKS IN ADVOCANOTE:**

Source configures qwen3.5:0.8b at http://127.0.0.1:11434 and calls it via Client.chat. No fine-tuning path was found in the active analysis service. To reproduce a local setup conceptually, install the compatible runner, make the exact tag available, start it, and send a synthetic inference request.

**ACTUAL CODE CONNECTION:**

- [app/services/legal_ai.py, line 11](../../advocanote-backend/app/services/legal_ai.py#L11)
- [app/services/legal_ai.py, line 1195](../../advocanote-backend/app/services/legal_ai.py#L1195)

**WHY IS IT USED?**

A small model may reduce resource use, but must be tested for task accuracy, especially Tamil and legal dates. A larger or remote model might improve quality at operational and privacy cost.

**POSSIBLE ERRORS AND DEBUGGING:**

Check the runner process and listener from the same machine or container as Python, inspect model availability, and measure warm/cold latency and RAM with representative synthetic inputs. Treat the service URL and model tag as configuration evidence.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“The app is configured to call Qwen 3.5 at the qwen3.5:0.8b tag through a local Ollama service. The application uses inference and prompt instructions. I don't infer fine-tuning or hardware benchmarks from the code. I'd measure latency and memory in the target environment.”

**FOLLOW-UP QUESTION 1:**

Can you replace the model tag without retesting?

**FOLLOW-UP ANSWER 1:**

No. Structured output, language accuracy and performance may change even if the HTTP interface stays the same.

**FOLLOW-UP QUESTION 2:**

Why can a working desktop setup fail in Railway?

**FOLLOW-UP ANSWER 2:**

Loopback in Railway addresses the Railway runtime, so the developer's local Ollama is not reachable by that address.

---

<a id="question-050"></a>

### QUESTION 050 — Why did you use OpenRouter instead of connecting directly to an AI provider?

**Sister’s original ID S-K03.**

**COMPLETE ANSWER (English):**

An AI gateway such as OpenRouter provides a common API boundary for accessing multiple underlying providers. Teams may choose a gateway for portability or model routing while accepting an additional network, data-processing and reliability dependency. OpenRouter is not used by the inspected AdvocaNote diary inference path.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Gateway என்றால் ஒரே API address வழியா different providers-ஐ அணுகலாம். நம்ம project-ல அந்த extra gateway இல்லை. Backend Ollama client-ஐ direct-ஆ call பண்ணுது.

**HOW IT WORKS IN ADVOCANOTE:**

ask_qwen uses a direct localhost Ollama Python client. The application already separates the model call from downstream JSON parsing and evidence checks. A gateway migration would need its own client or adapter and verification.

**ACTUAL CODE CONNECTION:**

- [app/services/legal_ai.py, line 11](../../advocanote-backend/app/services/legal_ai.py#L11)
- [app/services/legal_ai.py, line 1195](../../advocanote-backend/app/services/legal_ai.py#L1195)
- [app/services/legal_ai.py, line 1246](../../advocanote-backend/app/services/legal_ai.py#L1246)

**WHY IS IT USED?**

Direct integration reduces cross-service hops. Gateway routing can help provider choice and redundancy, but fallback models must satisfy the same output and privacy contract.

**POSSIBLE ERRORS AND DEBUGGING:**

Inspect import/client and base URL before claiming any integration. For a proposed gateway verify error handling, model identity, data-processing terms and its ability to meet application response requirements with synthetic content.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I did not use OpenRouter in AdvocaNote. The legal analysis service calls Qwen through Ollama directly. A gateway could offer model routing, but I would only introduce it after checking provider privacy, failure handling and output compatibility.”

**FOLLOW-UP QUESTION 1:**

Can a gateway make provider fallbacks automatically safe for legal notes?

**FOLLOW-UP ANSWER 1:**

No. Model validity, provenance, privacy agreements, and user-data policy still need application decisions.

**FOLLOW-UP QUESTION 2:**

What would you put behind an adapter?

**FOLLOW-UP ANSWER 2:**

Request options, authentication, timeouts, normalized responses and provider-specific errors.

---

<a id="question-051"></a>

### QUESTION 051 — How do you send prompts to Gemini and handle its responses?

**Sister’s original ID S-K04.**

**COMPLETE ANSWER (English):**

A managed generative API typically receives model selection, messages or instructions, and output settings; it returns content or a structured result plus status/metadata. Gemini is one example of a managed model family and API. Exact request syntax is vendor-specific. Gemini is not part of the inspected legal-analysis implementation.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Gemini call பண்ணும் app prompt அனுப்பி response வாங்கும். நம்ம project Ollama-க்கு prompt அனுப்புது. இரண்டு implementation-க்கும் response validate பண்ண வேண்டியது முக்கியம்.

**HOW IT WORKS IN ADVOCANOTE:**

ask_qwen prepares system and user messages with language instructions, asks Ollama for JSON, parses the content and checks the returned shape. Further filtering relates model suggestions to source statements.

**ACTUAL CODE CONNECTION:**

- [app/services/legal_ai.py, line 1195](../../advocanote-backend/app/services/legal_ai.py#L1195)
- [app/services/legal_ai.py, line 1232](../../advocanote-backend/app/services/legal_ai.py#L1232)
- [app/services/legal_ai.py, line 695](../../advocanote-backend/app/services/legal_ai.py#L695)

**WHY IS IT USED?**

A provider schema or JSON format helps reduce syntax issues. After parsing, server validation and source evidence remain essential. A managed provider would also need controls for data transfer and provider response failures.

**POSSIBLE ERRORS AND DEBUGGING:**

Create mock outputs with JSON object, malformed text, wrong types and an unsupported date. Check that only appropriate results move to human review. Do not send actual case text to a provider while studying.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I did not send prompts to Gemini in AdvocaNote. My implemented equivalent is a chat call to Qwen through Ollama. The service constructs system and user messages, asks for JSON, parses the response and checks evidence before showing suggestions.”

**FOLLOW-UP QUESTION 1:**

Does valid JSON establish factual accuracy?

**FOLLOW-UP ANSWER 1:**

No. Syntax and evidence are separate. A valid JSON object can contain an invented date.

**FOLLOW-UP QUESTION 2:**

Why separate system instructions from user input?

**FOLLOW-UP ANSWER 2:**

It establishes the expected role and constraints separately from user data, though it does not guarantee immunity to prompt injection.

---

<a id="question-052"></a>

### QUESTION 052 — What happens when the API fails, reaches its rate limit, or returns an unexpected response?

**Sister’s original ID S-K05.**

**COMPLETE ANSWER (English):**

A failed model call can mean an unavailable service, a timeout, saturation/rate limit, bad transport, malformed payload, or a plausible but invalid answer. Recover only within the expected operation. Retry transient failures deliberately, with bounded backoff and user feedback. Provider rate limits and local CPU pressure are different constraints.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

AI reply வரலன்னா ‘all app broken’ன்னு சொல்ல வேண்டாம். Connection fail, slow model, wrong JSON, wrong facts என்னன்னு classify பண்ணணும்.

**HOW IT WORKS IN ADVOCANOTE:**

The local Ollama client is configured with a timeout. ask_qwen parses JSON. analyze_legal_transcript catches failures per batch and can mark analysis_incomplete. The app has manual diary input, and saving a diary does not require AI output.

**ACTUAL CODE CONNECTION:**

- [app/services/legal_ai.py, line 11](../../advocanote-backend/app/services/legal_ai.py#L11)
- [app/services/legal_ai.py, line 1232](../../advocanote-backend/app/services/legal_ai.py#L1232)
- [app/services/legal_ai.py, line 1339](../../advocanote-backend/app/services/legal_ai.py#L1339)
- [app/schemas/diary.py](../../advocanote-backend/app/schemas/diary.py)

**WHY IS IT USED?**

Allow degraded output or manual completion for optional analysis. For persistent provider failures consider circuit breaking and bounded concurrency. A 429 policy is general design unless demonstrated for a particular integration.

**POSSIBLE ERRORS AND DEBUGGING:**

Use synthetic mocks for connection refusal, timeout, malformed JSON and valid but unsupported facts. Inspect safe timing and failure context, and verify the final partial status and manual fallback. Do not expose raw case notes.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“If Qwen or Ollama fails, I separate connectivity from response validation. The current service can mark results incomplete on failed batches, and the lawyer can still use manual diary input. I would avoid unbounded retries.”

**FOLLOW-UP QUESTION 1:**

Should malformed JSON trigger unlimited retries?

**FOLLOW-UP ANSWER 1:**

No. Enforce a budget and classify failure. Repeated malformed output may need a controlled fallback or model/prompt change.

**FOLLOW-UP QUESTION 2:**

What is a safe circuit-breaker response?

**FOLLOW-UP ANSWER 2:**

Temporarily decline optional calls after repeated failures, then probe recovery. Preserve manually entered data.
