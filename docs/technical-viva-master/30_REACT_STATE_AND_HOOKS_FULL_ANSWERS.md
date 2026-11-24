# React state, effects, lists and context — Full Answers

இந்த chapter-ல் ஒவ்வொரு React concept-க்கும் AdvocaNote source example இருக்கு. முதலில் props/state, அதன் பிறகு effects மற்றும் shared context படிங்க.

<a id="question-059"></a>

### QUESTION 059 — What is the difference between props and state?

**Sister’s original ID S-H02.**

**COMPLETE ANSWER (English):**

Props are inputs from a parent. State is component-owned data React remembers between renders. Updating state schedules a render, while a child asks a parent to change parent-owned data through a callback. Both are treated as read-only snapshots during a render.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Parent child-க்கு value அனுப்பினா props. Component தன்னோட current value-ஐ React நினைவில் வச்சிருந்தா state.

**HOW IT WORKS IN ADVOCANOTE:**

DiaryMiniCalendar receives selectedDate and onSelect as props, and maintains its own month state. The parent owns the chosen date and uses it to load the overview.

**ACTUAL CODE CONNECTION:**

- [src/pages/MyLegalDiary.jsx, line 44](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L44)
- [src/pages/MyLegalDiary.jsx, line 167](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L167)

**WHY IS IT USED?**

Lift up state when siblings need one value. Keep month browsing local when only the calendar needs it. Context is useful for wider sharing but changes coupling.

**POSSIBLE ERRORS AND DEBUGGING:**

If selection appears stale, trace parent value and callback before duplicating it in child state. Check whether the child's local month is distinct from the parent's selected date.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“In AdvocaNote the mini calendar receives the selected date as a prop and calls the parent's callback when a day is selected. It keeps the displayed month in local state. That gives the API fetch and calendar one shared selection without coupling the month navigation.”

**FOLLOW-UP QUESTION 1:**

Can a child mutate a prop object?

**FOLLOW-UP ANSWER 1:**

JavaScript might allow it, but React components should treat props as immutable input and ask the owner to update state.

**FOLLOW-UP QUESTION 2:**

When should state be lifted?

**FOLLOW-UP ANSWER 2:**

When multiple components must agree on one value or coordinate its changes.

---

<a id="question-060"></a>

### QUESTION 060 — What is the difference between useState and useReducer?

**Sister’s original ID S-H03.**

**COMPLETE ANSWER (English):**

useState stores a value and exposes a setter. useReducer stores state too, but updates it by dispatching actions to a reducer that computes the next state. A reducer is useful for multiple related transitions and should remain pure.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Simple show/hideக்கு useState போதும். பல events ஒரே form workflow-ஐ change பண்ணினா reducer-ல் rules ஒரே இடத்தில் எழுதலாம்.

**HOW IT WORKS IN ADVOCANOTE:**

The inspected registration component uses useState for fields, submission, error and verification state. useReducer is a design alternative here.

**ACTUAL CODE CONNECTION:**

- [src/pages/Register.jsx, line 222](../../advocanote-frontend/src/pages/Register.jsx#L222)

**WHY IS IT USED?**

Separate states are easy to begin with. A reducer can make explicit transitions such as submitting → pending verification → verified or failed, at the cost of extra action definitions.

**POSSIBLE ERRORS AND DEBUGGING:**

Watch for impossible states such as a success banner and fatal error together. Observe transitions in DevTools or test the reducer function if introduced.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“AdvocaNote uses useState for registration values. A reducer would be useful if I needed one explicit state machine for many related status transitions. Both cause rerenders on relevant changes; the reducer centralizes decision logic.”

**FOLLOW-UP QUESTION 1:**

Does a reducer send the API request?

**FOLLOW-UP ANSWER 1:**

A reducer should compute next state without side effects. Initiate API work in the handler or effect as appropriate.

**FOLLOW-UP QUESTION 2:**

Do several state variables always justify a reducer?

**FOLLOW-UP ANSWER 2:**

No. Use it when coordinating transitions is harder than managing independent values.

---

<a id="question-061"></a>

### QUESTION 061 — What is useEffect? When does it execute?

**Sister’s original ID S-H04.**

**COMPLETE ANSWER (English):**

An effect synchronizes a component with an external system after a render is committed. Dependencies describe the reactive values used. React runs cleanup before rerunning the effect with changed dependencies and on unmount. Development Strict Mode may exercise setup and cleanup again when enabled.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

UI render ஆன பிறகு API call மாதிரி outside work செய்ய useEffect. Date change ஆனதும் பழைய effect cleanup ஆகி new date-க்கு request போகும்.

**HOW IT WORKS IN ADVOCANOTE:**

MyLegalDiary starts getDiaryOverview after currentUser is known. Dependencies are currentUser, selectedDate and refreshTick. Cleanup sets active=false so an earlier response cannot update state after that effect is obsolete.

**ACTUAL CODE CONNECTION:**

- [src/pages/MyLegalDiary.jsx, line 193](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L193)
- [src/pages/MyLegalDiary.jsx, line 226](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L226)

**WHY IS IT USED?**

A query-cache library could manage cancellation and request keys. AbortController can cancel waiting on the browser network request; the existing active guard prevents stale state application but does not abort the request.

**POSSIBLE ERRORS AND DEBUGGING:**

Simulate two fast date changes and let the earlier request finish last. Verify only the newest result displays. Watch unstable object identity in currentUser if the effect runs unexpectedly.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“The diary effect fetches when the user, selected date or refresh tick changes. Its cleanup marks the old request inactive, so an outdated response cannot replace the current day's data.”

**FOLLOW-UP QUESTION 1:**

Does the active flag cancel the HTTP request?

**FOLLOW-UP ANSWER 1:**

No. It suppresses the outdated handler's updates. Actual cancellation would use a cancellation mechanism passed to fetch.

**FOLLOW-UP QUESTION 2:**

When can an effect loop?

**FOLLOW-UP ANSWER 2:**

If it changes a dependency on each execution, or a dependency identity is recreated continually and the effect triggers state updates.

---

<a id="question-062"></a>

### QUESTION 062 — What is the purpose of React keys when rendering lists?

**Sister’s original ID S-H05.**

**COMPLETE ANSWER (English):**

A key gives React a stable sibling identity across list updates. During reconciliation it helps associate a rendered row with the same logical item after reordering or deletion. It is consumed by React and is not automatically a normal child prop.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

List reorder ஆனாலும் இந்த row எந்த diary entry என்று React-க்கு ID சொல்லணும். அதுதான் key வேலை.

**HOW IT WORKS IN ADVOCANOTE:**

Diary rows use entry.id. Available plan rows use plan.id. Both identify logical records that can survive reordering across renders.

**ACTUAL CODE CONNECTION:**

- [src/pages/MyLegalDiary.jsx, line 863](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L863)
- [src/pages/Subscription.jsx, line 1459](../../advocanote-frontend/src/pages/Subscription.jsx#L1459)

**WHY IS IT USED?**

A database ID is suitable for persisted rows. Temporary rows need stable client IDs. Array index is acceptable only for genuinely fixed positions with no identity-sensitive reordering.

**POSSIBLE ERRORS AND DEBUGGING:**

If row edits or focus jump after filtering, inspect duplicate or index-based keys and whether the data actually contains stable IDs.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I use entry.id for diary row keys. When rows are filtered or reordered, React can preserve the relationship between the component and its record. Index keys can attach state to the wrong record when order changes.”

**FOLLOW-UP QUESTION 1:**

Can keys repeat in different lists?

**FOLLOW-UP ANSWER 1:**

Yes. Keys need to be unique among siblings where React compares them.

**FOLLOW-UP QUESTION 2:**

What happens if you change a component's key intentionally?

**FOLLOW-UP ANSWER 2:**

React treats it as a new identity and typically resets its component state.

---

<a id="question-063"></a>

### QUESTION 063 — What is the difference between controlled and uncontrolled components?

**Sister’s original ID S-H06.**

**COMPLETE ANSWER (English):**

A controlled input gets its current value from React and sends changes via handlers. An uncontrolled input lets the DOM hold current state, with JavaScript reading it through a ref or FormData. Both exist alongside native browser input rules.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Register email box-ல் value React state-லிருந்து வருது. Type பண்ணினா handler state update பண்ணுது. Uncontrolled field-ல் DOM தான் current value வைத்திருக்கும்.

**HOW IT WORKS IN ADVOCANOTE:**

Registration passes form.email and other fields as value props, then uses change handlers to update state. Submission can validate all related values before posting.

**ACTUAL CODE CONNECTION:**

- [src/pages/Register.jsx, line 222](../../advocanote-frontend/src/pages/Register.jsx#L222)
- [src/pages/Register.jsx, line 568](../../advocanote-frontend/src/pages/Register.jsx#L568)

**WHY IS IT USED?**

Controlled inputs suit interactive validation and conditional UI. Uncontrolled inputs can reduce typing renders for simple forms. File inputs often use browser-oriented reading patterns.

**POSSIBLE ERRORS AND DEBUGGING:**

If typing appears blocked, verify value and change handler update the same state key. Initialize strings consistently to avoid swapping between controlled and uncontrolled conventions.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“My registration form uses controlled inputs. React state supplies displayed values, and change handlers update them. That lets the form compare password and confirmation before sending the request.”

**FOLLOW-UP QUESTION 1:**

Can the controlled input guarantee security?

**FOLLOW-UP ANSWER 1:**

No. It is client behavior. The server still validates the submitted payload.

**FOLLOW-UP QUESTION 2:**

What happens if value is fixed and onChange never updates it?

**FOLLOW-UP ANSWER 2:**

The displayed value stays controlled by the fixed React value, so typing will not persist.

---

<a id="question-064"></a>

### QUESTION 064 — What is conditional rendering?

**Sister’s original ID S-H07.**

**COMPLETE ANSWER (English):**

Conditional rendering selects what JSX to display according to state, such as a ternary for two branches or a conditional guard for optional content. Mounting a different branch can reset local child state, so transitions should model user intent.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Backend pending verification கொடுத்தா OTP fields காட்டணும். இல்லன்னா normal register form அல்லது valid session path proceed ஆகும்.

**HOW IT WORKS IN ADVOCANOTE:**

Register.jsx uses verificationRequired to change the heading and form content and to show the resend action. The submit handler calls showCodeDelivery for a verification-required response and avoids completing sign-in there.

**ACTUAL CODE CONNECTION:**

- [src/pages/Register.jsx, line 249](../../advocanote-frontend/src/pages/Register.jsx#L249)
- [src/pages/Register.jsx, line 365](../../advocanote-frontend/src/pages/Register.jsx#L365)
- [src/pages/Register.jsx, line 511](../../advocanote-frontend/src/pages/Register.jsx#L511)

**WHY IS IT USED?**

A dedicated OTP route can support deep links but needs a safe way to preserve pending state; in-page branching keeps the flow in one component. Rendering alone is not an auth barrier.

**POSSIBLE ERRORS AND DEBUGGING:**

Test with mock pending, delivery failure and successful session responses. Confirm the intended screen and that the pending state does not create stored auth tokens.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“The registration UI renders different content for an OTP-pending backend response. It shows the code entry and only completes sign-in after an appropriate verified session response. The backend remains the authority for access.”

**FOLLOW-UP QUESTION 1:**

Why use a ternary here?

**FOLLOW-UP ANSWER 1:**

It expresses exactly two alternative UI branches for one boolean state.

**FOLLOW-UP QUESTION 2:**

Can hiding a dashboard link enforce login?

**FOLLOW-UP ANSWER 2:**

No. The protected API must verify the session independently.

---

<a id="question-065"></a>

### QUESTION 065 — What is prop drilling? How can you avoid it?

**Sister’s original ID S-H08.**

**COMPLETE ANSWER (English):**

Prop drilling passes values through intermediate components that do not use them. It can make component interfaces noisy. Context, composition, or relocating state can remove intermediate forwarding. Explicit props remain beneficial for small, local data flows.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

ஒரு value middle components எல்லாத்துக்கும் அனுப்பிட்டு கடைசி child மட்டும் use பண்ணினா அது prop drilling. Shared layout data-க்கு context useful.

**HOW IT WORKS IN ADVOCANOTE:**

LawyerLayout supplies shared context. Calendar, MyCases, Hearings and AddDiaryEntry consume shared values through useLawyerLayout, so intermediary route wrapper components do not each need to pass the same props.

**ACTUAL CODE CONNECTION:**

- [src/components/LawyerLayout.jsx, line 53](../../advocanote-frontend/src/components/LawyerLayout.jsx#L53)
- [src/components/LawyerLayout.jsx, line 349](../../advocanote-frontend/src/components/LawyerLayout.jsx#L349)
- [src/pages/Calendar.jsx, line 338](../../advocanote-frontend/src/pages/Calendar.jsx#L338)

**WHY IS IT USED?**

Use context for layout-level concerns, props for local dependencies, and a dedicated state or query layer if sharing and update patterns grow more complex.

**POSSIBLE ERRORS AND DEBUGGING:**

If the value is absent, verify the component sits under the corresponding provider. If unrelated children rerender, inspect value identity and whether the context is too broad.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“For shared lawyer layout state I expose a context hook. Pages can directly read layout values without passing them through every wrapper. For a small parent-child interaction I still prefer explicit props.”

**FOLLOW-UP QUESTION 1:**

What is a cost of context?

**FOLLOW-UP ANSWER 1:**

Consumers depend on a provider and can rerender when the provided value changes.

**FOLLOW-UP QUESTION 2:**

Does adding context eliminate a need for server-side authorization?

**FOLLOW-UP ANSWER 2:**

No. It only shares data within the React tree.

---

<a id="question-066"></a>

### QUESTION 066 — What is React Context API?

**Sister’s original ID S-H09.**

**COMPLETE ANSWER (English):**

React Context supplies a value from a provider to descendant consumers. A consumer observes the closest compatible provider. Context can share state and callbacks, but its value must still come from an actual state owner. Memoizing an object can reduce unnecessary identity changes.

**SIMPLE TAMIL-ENGLISH EXPLANATION:**

Layout provider குழந்தை components-க்கு common data கொடுக்கும். கீழே எந்த page-க்கும் hook use பண்ணி அந்த value எடுக்கலாம்.

**HOW IT WORKS IN ADVOCANOTE:**

LawyerLayoutContext is created with a default. useLawyerLayout reads it. The layout assembles the provided object with useMemo and renders a provider. A notification component can read the current user from it.

**ACTUAL CODE CONNECTION:**

- [src/components/LawyerLayout.jsx, line 53](../../advocanote-frontend/src/components/LawyerLayout.jsx#L53)
- [src/components/LawyerLayout.jsx, line 310](../../advocanote-frontend/src/components/LawyerLayout.jsx#L310)
- [src/components/LawyerLayout.jsx, line 349](../../advocanote-frontend/src/components/LawyerLayout.jsx#L349)
- [src/components/NotificationBell.jsx, line 148](../../advocanote-frontend/src/components/NotificationBell.jsx#L148)

**WHY IS IT USED?**

Context is suitable for shared layout state. A store can offer selector-based subscriptions for frequent fine-grained updates, and explicit props make dependencies visible for isolated component tests.

**POSSIBLE ERRORS AND DEBUGGING:**

Use a provider in test harnesses that need layout values. Inspect provider value changes if consumers rerender. Never treat the context's user object as proof that an API request is authorized.

**SHORT ANSWER FOR MY TECHNICAL VIVA:**

“I use React Context for shared lawyer layout values. The layout creates and provides the state and callbacks, and pages consume them via a custom hook. That avoids repetitive props while the backend still verifies the session for protected requests.”

**FOLLOW-UP QUESTION 1:**

Can a component outside the provider receive the actual layout instance?

**FOLLOW-UP ANSWER 1:**

No. It sees the default context value or any explicit fallback the hook provides.

**FOLLOW-UP QUESTION 2:**

Why memoize a provided object?

**FOLLOW-UP ANSWER 2:**

To avoid creating a different reference solely because the provider rerendered, when its underlying values did not change.

## Code walkthrough · The beginning of the diary effect

```jsx
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    const requestKey = `${currentUser.id}:${selectedDate}:${refreshTick}`;

    getDiaryOverview(selectedDate)
```

This excerpt stops at the first call. The actual callback continues with success/error handlers and cleanup. [MyLegalDiary.jsx, line 193](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L193)

- **useEffect** — Render முடிஞ்ச பிறகு diary data-வை API-லிருந்து sync பண்ணுற வேலை இங்கே ஆரம்பிக்கிறது.
- **if (!currentUser) return** — User object ready இல்லாட்டி இந்த run request போடாது.
- **let active = true** — இந்த run-க்கு மட்டும் ஒரு local flag. Cleanup false ஆக்கும். ஒரு பழைய Promise முடிஞ்சாலும் அந்த result screen-ஐ மாற்றாமல் இருக்க இது உதவும்.
- **requestKey** — User, date, refresh generation மூன்றையும் key-ஆ சேர்க்கிறது. Success/error path அந்த request settled என்பதை state-ல் mark பண்ணுவதற்கு key-ஐ use பண்ணுகிறது.
- **getDiaryOverview(selectedDate)** — API helper date query-யை உருவாக்கி GET அனுப்புகிறது. இந்த call-ன் Promise resolve ஆனால் entries/stats update ஆகும். Reject ஆனால் defaults மற்றும் error message set ஆகும், இந்த run இன்னும் active இருந்தால்.
- **Effect end** — Cleanup flag-ஐ false ஆக்குகிறது. Dependency array-ல் currentUser, selectedDate, refreshTick. அவற்றில் ஒன்று மாறினா புதிய effect run உருவாகும். [Cleanup and dependencies](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L224)
