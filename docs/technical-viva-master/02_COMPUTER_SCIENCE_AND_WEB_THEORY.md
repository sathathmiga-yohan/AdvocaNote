# Computer science and web theory

Beginner முதல் advanced வரை request trace-ஐ அடிப்படையா வைத்து படிங்க. Theory பொதுவானது. Code links local AdvocaNote evidence.

<a id="web-01"></a>

## WEB-01 — What is programming?

**Simple Tamil-English.** Computer-க்கு input வந்தா என்ன rule follow பண்ணணும், என்ன result கொடுக்கணும் என்று எழுதுறதுதான் programming.

**Theory.** Inputs, conditions, state changes, and results describe execution. An I/O side effect reads or changes something outside the function.

**AdvocaNote and execution.** Date and authenticated lawyer → scoped query → matching diary entries. [Actual code](../../advocanote-backend/app/routers/diary.py#L129)

**Why and alternatives.** Query-level filtering reduces data transfer; application-memory filtering is simpler for tiny in-memory inputs.

**Possible problems and debugging.** Empty results can be valid. Check date and owner conditions in an isolated fixture. An absent owner filter is a separate security concern.

**Short viva answer.** “Programming means expressing rules a computer can execute. In AdvocaNote, the diary overview uses the selected date and the authenticated owner's ID to read the matching records, then returns a result the frontend can render.”

**Follow-up and answer.** Can a function return a result and cause a side effect? Yes. A write operation might commit an entry and return its ID.

<a id="web-02"></a>

## WEB-02 — How does a web application work from action to screen update?

**Simple Tamil-English.** Button அழுத்தினா frontend request அனுப்பும். Backend response வந்ததும் UI-யில் data மாறும்.

**Theory.** The browser and server communicate over a request/response protocol. Server rules own protected state; UI state represents current presentation.

**AdvocaNote and execution.** Diary date state → getDiaryOverview → API → owned records → response → page. [Actual code](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L193)

**Why and alternatives.** Separate UI/API supports reuse. Server-rendered HTML is an alternative with different browser lifecycle.

**Possible problems and debugging.** Check Request URL, HTTP status, response shape, then state. A spinner alone doesn't establish network failure.

**Short viva answer.** “A browser event triggers an API call. The API uses the authenticated identity, applies its rules, and returns the result. React renders the resulting data or error state.”

**Follow-up and answer.** Can React directly reach MySQL in this architecture? No. The API mediates access and owns database credentials.

<a id="web-03"></a>

## WEB-03 — How do domains, DNS, IP addresses and ports relate?

**Simple Tamil-English.** Domain ஒரு பெயர். DNS அந்தப் பெயருக்கு address கண்டுபிடிக்க உதவும். IP எந்த destination, port எந்த service என்று சொல்லும்.

**Theory.** URL scheme, host and port identify the connection target. A service may sit behind a proxy. Loopback addresses always refer to the local host or network namespace.

**AdvocaNote and execution.** Diary helper chooses a configured API URL or a production/development fallback. The local fallback points to 127.0.0.1:8000. [Actual code](../../advocanote-frontend/src/services/diary.js#L2)

**Why and alternatives.** Domain names allow endpoint changes behind a stable name. A fixed loopback address is practical for local dev.

**Possible problems and debugging.** Inspect built Request URL. A frontend pointing to localhost in production sends the request toward the visitor's device.

**Short viva answer.** “DNS resolves the host name. IP identifies the destination and port identifies the service. A development loopback address is suitable on my machine; the deployed client must target the hosted backend.”

**Follow-up and answer.** Can two services listen on the same machine? Yes, for example on different ports.

<a id="web-04"></a>

## WEB-04 — How do TCP/IP, HTTP, and HTTPS fit together?

**Simple Tamil-English.** HTTP என்ன கேக்குறோம், என்ன பதில் வரும் என்று define பண்ணுது. HTTPS அந்த communication-ஐ TLS வழியா பாதுகாக்குது.

**Theory.** IP addresses packets. TCP provides reliable ordered stream transport. Common HTTPS over HTTP/1.1 or HTTP/2 uses TLS over TCP; HTTP/3 uses QUIC over UDP. TLS handles channel encryption and peer authentication.

**AdvocaNote and execution.** A diary request includes a bearer credential; the production fallback URL is HTTPS. [Actual code](../../advocanote-frontend/src/services/diary.js#L23)

**Why and alternatives.** Loopback HTTP supports local development. Public API requests need encrypted transport and a trusted certificate.

**Possible problems and debugging.** Look for mixed content, certificate/hostname errors, or blocked cross-origin requests. These are different failures.

**Short viva answer.** “HTTPS protects traffic in transit. AdvocaNote sends an access token with protected API calls, so hosted requests use HTTPS. Application authentication and ownership checks still run on the backend.”

**Follow-up and answer.** Does TLS prove the caller owns a diary record? No. TLS and application authorization protect different boundaries.

<a id="web-05"></a>

## WEB-05 — What is inside an HTTP request and response?

**Simple Tamil-English.** Request-ல் method மற்றும் URL இருக்கும். Headers கூடுதல் information. Response-ல் status மற்றும் data அல்லது error வரும்.

**Theory.** A query parameter is URL data. An authorization header carries a credential. POST typically carries a body; a GET read can use query values.

**AdvocaNote and execution.** GET /diary/overview?entry_date=… with Authorization: Bearer …; the backend parses the date and returns data or error information. [Actual code](../../advocanote-frontend/src/services/diary.js#L53)

**Why and alternatives.** GET expresses a filtered read. A complex structured search might use a POST endpoint with different cache semantics.

**Possible problems and debugging.** A missing token can fail client-side before a request. A malformed date may cause 422. Inspect Network and status without copying tokens.

**Short viva answer.** “The diary page sends a GET using a query date and Bearer credential. FastAPI parses and authorizes it, and the browser receives a status and JSON response. The client helper checks success before updating the page.”

**Follow-up and answer.** Why encode the date query value? To keep any special characters in the value from changing the URL structure.

<a id="web-06"></a>

## WEB-06 — How do JSON serialization, deserialization and validation differ?

**Simple Tamil-English.** Object-ஐ text-ஆ அனுப்புவது serialization. Text-ஐ read பண்ணி values எடுக்கிறது deserialization. Values rules-க்கு சரியா check பண்ணுவது validation.

**Theory.** JSON represents strings, numbers, arrays, objects, booleans and null. Date values normally travel as strings. A parseable body can still fail schema or business rules.

**AdvocaNote and execution.** createDiaryEntry calls JSON.stringify(payload) and POSTs to /diary/entries; backend schema validates the data before ownership and write rules. [Actual code](../../advocanote-frontend/src/services/diary.js#L59)

**Why and alternatives.** JSON is readable and interoperable. Multipart suits audio files. Protocol Buffers is a general alternative for typed binary messaging.

**Possible problems and debugging.** Check Content-Type, field names, types, and the response's validation detail. A valid case ID type does not prove case ownership.

**Short viva answer.** “My diary save serializes the JavaScript payload as JSON. FastAPI parses and validates it. Then protected business rules decide whether to write the entry. JSON formatting alone doesn't determine acceptance.”

**Follow-up and answer.** Can a syntactically valid JSON body fail? Yes. A required field may be absent or of the wrong type.

<a id="web-07"></a>

## WEB-07 — How does a browser render a React page?

**Simple Tamil-English.** HTML structure, CSS appearance, JavaScript behavior. React app HTML-ல் உள்ள root element-க்குள்ளே mount ஆகுது.

**Theory.** Browser parses HTML into DOM and computes styles/layout/paint. React reconciliation maps component output to DOM updates. React render and browser paint are different stages.

**AdvocaNote and execution.** main.jsx calls createRoot and renders App inside GoogleOAuthProvider. App route matches the requested screen. [Actual code](../../advocanote-frontend/src/main.jsx#L11)

**Why and alternatives.** Components simplify UI with changing data. Static HTML can be sufficient for pages without app state.

**Possible problems and debugging.** A blank page can come from a bundle 404 or a JavaScript exception after the HTML loads. Read Console and Network.

**Short viva answer.** “The browser loads AdvocaNote's HTML and bundled JS. React mounts into the root DOM element. Router and state decide what is rendered, and the browser handles layout and paint.”

**Follow-up and answer.** Does React recreate the entire DOM on each render? No. It reconciles changes and commits the required DOM updates.

<a id="web-08"></a>

## WEB-08 — How do cookies, browser storage and server sessions differ?

**Simple Tamil-English.** Browser-ல் login value save பண்ணலாம். Server-லும் அந்த login active இருக்கா என்று record வைத்திருக்கலாம்.

**Theory.** Cookies can be attached by the browser under policy. localStorage is accessed by script and is not sent automatically. Server-side records support revocation separate from client storage.

**AdvocaNote and execution.** Login stores access and refresh values; /auth/me uses Bearer auth and get_current_user checks the session. The auth toast marker is UI state. [Actual code](../../advocanote-frontend/src/pages/Login.jsx#L199)

**Why and alternatives.** Bearer API access is explicit. HttpOnly cookies hide the cookie value from JavaScript but need cookie and CSRF design.

**Possible problems and debugging.** Stored credentials can be stale or exposed by same-origin XSS. Check key presence, request status, session status and expiry without logging secrets.

**Short viva answer.** “AdvocaNote stores token values in browser localStorage and sends the access token as a Bearer header. The backend verifies the token and checks the login session, so storing a token alone doesn't guarantee continued access.”

**Follow-up and answer.** What happens when the server revokes the session? A valid-looking client token can no longer establish that session.

<a id="web-09"></a>

## WEB-09 — What is a browser origin and what does CORS do?

**Simple Tamil-English.** Origin-ன்னா scheme, host, port. Frontend மற்றும் API வேறு origins என்றால் browser-க்கு API permission headers தேவை.

**Theory.** Cross-Origin Resource Sharing controls browser access to cross-origin responses. Requests with Authorization can trigger an OPTIONS preflight. Auth enforcement is still server-side.

**AdvocaNote and execution.** CORSMiddleware allows specified dev origins and the origin derived from frontend configuration. [Actual code](../../advocanote-backend/app/main.py#L129)

**Why and alternatives.** Explicit allowlist matches separate hosting. Same-origin proxy is an alternative for a different deployment design.

**Possible problems and debugging.** Check preflight response, exact Origin, headers and whether the request reaches the handler. A successful CLI request is not proof a browser is allowed.

**Short viva answer.** “Vercel and Railway are different origins. FastAPI returns browser CORS headers for allowlisted origins. Auth then determines the user's actual permissions.”

**Follow-up and answer.** Why might localhost and 127.0.0.1 behave differently? They are different host parts of an origin.

<a id="web-10"></a>

## WEB-10 — What is an SPA and why does a deep link need a rewrite?

**Simple Tamil-English.** React page-க்குள்ளே navigation நடக்கும். Refresh பண்ணினா hosting server-க்கு அந்த URL direct request ஆகும்.

**Theory.** Client-side routing updates browser history. Direct requests need the host to return the SPA entry HTML so the client router can select the page.

**AdvocaNote and execution.** Vercel config rewrites to index.html; React Router then matches /my-legal-diary and applies the route guard. [Actual code](../../advocanote-frontend/vercel.json)

**Why and alternatives.** A rewrite preserves clean URLs. Hash routing is an alternative that avoids requesting the client route from the host.

**Possible problems and debugging.** Compare click navigation and direct refresh. A hosting 404 before the app loads differs from an API 404 after render.

**Short viva answer.** “AdvocaNote uses a React SPA. Vercel serves the entry HTML for client routes, and React handles the path and auth guard after the bundle loads.”

**Follow-up and answer.** Does a rewrite grant protected access? No. It only gives the browser the application entry.

<a id="web-11"></a>

## WEB-11 — How do synchronous, asynchronous and parallel execution differ?

**Simple Tamil-English.** Sync-ல் இந்த வேலை முடிஞ்சா அடுத்த வேலை. Async-ல் wait நேரத்தில் வேற task ஓடலாம். Parallel என்றால் வேலைகள் உண்மையிலேயே ஒரே நேரத்தில் ஓடுகின்றன.

**Theory.** Await suspends a coroutine until awaitable progress is available. An event loop can run other ready work. Blocking synchronous work in the event-loop thread still blocks it.

**AdvocaNote and execution.** lifespan schedules trial_notification_scheduler, yields to serving, and cancels/awaits on shutdown. The notification loop uses to_thread for synchronous checks. [Actual code](../../advocanote-backend/app/main.py#L93)

**Why and alternatives.** In-process scheduling is straightforward for process-bound work. Durable workers are an option for retried or long-lived jobs.

**Possible problems and debugging.** Measure whether latency is I/O wait or a blocked loop. Consider duplicate execution across worker processes and cancellation of ongoing thread work.

**Short viva answer.** “AdvocaNote creates a scheduler task during startup, lets the backend serve, then cancels and awaits it on shutdown. Async lets tasks share wait time; it does not by itself promise parallel CPU execution.”

**Follow-up and answer.** Does create_task start a new process? No. It schedules a coroutine on the event loop.

<a id="web-12"></a>

## WEB-12 — How do modules differ from independently deployed services?

**Simple Tamil-English.** நிறைய Python files இருக்கிறது என்றால் code parts-ஆ பிரிச்சிருக்கு. அந்த parts தனித்தனியா deploy ஆகுது என்பது வேறு architecture decision.

**Theory.** A modular monolith shares an application deployment across domains. Microservices have independent runtime/deployment boundaries and coordinate across a network.

**AdvocaNote and execution.** Auth, diary, tasks and billing routers mount on one FastAPI app. Ollama and Stripe are separate dependencies. [Actual code](../../advocanote-backend/app/main.py#L144)

**Why and alternatives.** One deployment simplifies common guards and local transactions. Separate inference could isolate resource usage at the cost of networking and retry complexity.

**Possible problems and debugging.** Trace failed routes to their dependencies. An Ollama failure need not imply a MySQL read failure. Measure workload before proposing a split.

**Short viva answer.** “I describe the AdvocaNote API as a modular FastAPI backend. Its domain routers run in one application. The frontend is separately hosted and the backend depends on systems such as MySQL, Ollama and Stripe.”

**Follow-up and answer.** What would justify moving inference to a separate worker? Measurable contention with normal requests and an acceptable job/review UX.
