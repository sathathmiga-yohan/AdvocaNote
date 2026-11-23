# 02 · Frontend complete guide

Sources are under `D:/AdvocaNote/advocanote-frontend`. The per-file index below links importers, imports, source declarations, hook locations, and API call sites. For cross-layer flows, see [chapter 08](08_FEATURE_WORKFLOWS.md).

## Startup and routing

The Vite entry HTML provides a root element. [main.jsx](../../advocanote-frontend/src/main.jsx#L11) mounts React with `createRoot` and wraps `App` in the Google OAuth provider using the public client identifier. Importing `StrictMode` does not enable it here because it is not rendered. [App.jsx](../../advocanote-frontend/src/App.jsx#L59) uses `BrowserRouter`, nested `Route` elements, and a storage-event effect that reloads or redirects another tab when the access-token key changes.

| Route group | Actual routes and page responsibilities |
|---|---|
| Public | `/` marketing and price copy; `/login` password and Google sign-in; `/register` lawyer form; `/rejoin-account` closed account recovery; `/forgot-password`, `/reset-password`, and `/verify-email` account recovery/verification screens. |
| Lawyer | `/my-legal-diary` dashboard and history; `/add-diary-entry` form and recording workflow; `/diary-entry-details/:entryId` saved text, edits and recording display; `/cases`, `/hearings`, `/tasks`, `/calendar` workspace views; `/ai-suggestions` reviews suggested tasks; `/profile` edits profile and account controls. |
| Billing | `/subscription`, `/subscription/success`, and `/subscription/cancel` render the same Subscription component. The success URL causes verification/polling with the Checkout Session ID. A success route by itself never grants access. |
| Admin | `/admin` dashboard and relative `lawyers`, `subscriptions`, `notifications`, `settings` are inside the admin layout and role gate. The admin plan manager lives within the admin experience, not as an independent top-level route. |

## State, effects, derived data, and props

- `useState` stores field values, modal state, loading flags, lists and errors. In [Register.jsx](../../advocanote-frontend/src/pages/Register.jsx#L258), form submission trims/canonicalizes values, checks fields and password confirmation, then calls the auth service and displays the result. Server-side validation still decides what gets accepted.
- `useEffect` synchronizes with an outside system after render. The router effect subscribes to browser storage events and removes the handler in cleanup. Subscription effects load data and poll verification. Read effect dependencies together with its timer or cancellation logic.
- `useRef` stores mutable data that does not itself require a render. Look for recording/media and cleanup references in [AddDiaryEntry.jsx](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx). `useMemo` derives values such as the selected catalog entry from loaded plans and subscription state. `useCallback` helps stabilize callback identity in effects; the per-file hook index points to the actual calls.
- The code relies on component state, props and browser storage rather than an observed Redux store. Layout components render nested children using `Outlet`; lawyer onboarding receives the current user as a prop. Card data flows through the Subscription page's mapped items. Dialog controls and form callbacks communicate upward via props where connected.
- A `fetch` promise can resolve with HTTP 4xx/5xx. The helpers inspect the result, parse response bodies and set UI error messages. Several pages have local request helpers, so handling and base-URL selection are not fully centralized.

## Guards and API transport

[ProtectedRoute](../../advocanote-frontend/src/components/ProtectedRoute.jsx) checks access with the auth service and chooses loading, redirect or children. [LawyerLayout](../../advocanote-frontend/src/components/LawyerLayout.jsx#L444) renders the shell, onboarding and [SubscriptionGate](../../advocanote-frontend/src/components/SubscriptionGate.jsx). The gate loads `GET /subscriptions/access`, handles expiry and quota UI, and routes payment recovery to Manage Billing. [AdminRoute](../../advocanote-frontend/src/admin/AdminRoute.jsx) checks the server-supplied role. Those guards are UX checks; FastAPI enforces authorization independently.

Auth, diary, onboarding, profile, OTP, and voice each have service modules under `src/services`. A page can alternatively call fetch itself. Requests include a Bearer access token when required, JSON for structured data and `FormData` for uploads. The helper and caller inventories distinguish these forms. Access/refresh token keys are browser storage entries; onboarding flags and some view state use their own keys. Browser storage exposes token strings to same-origin JavaScript, so frontend XSS matters.

## Styles and configuration

`src/index.css` is loaded at bootstrap. Layouts/components/pages import separate CSS, often with scoped-looking class prefixes and responsive media rules. Later CSS still participates in the cascade and can override earlier selectors. Available Plans uses [Subscription.css](../../advocanote-frontend/src/pages/Subscription.css#L642); billing behavior remains in JSX and the API. [Vite config](../../advocanote-frontend/vite.config.js) wires React and Tailwind and sets a development opener policy for popup compatibility. Some modules read `VITE_API_URL`, others `VITE_API_BASE_URL`, with possible loopback fallbacks; public Google initialization reads `VITE_GOOGLE_CLIENT_ID`. These compiled browser variables cannot hold secrets. A misaligned API base can break one page while another still works.

## Reading any feature page

1. Find the imported page in App and the containing layout.
2. Find its initial effect and service import. Identify the input state and the endpoint it loads.
3. Trace the handler from the button or form, then the request shape and server error path.
4. Find the state refresh after success and the cleanup on unmount.
5. Check the actual mounted API and owner/role rules. Explain why hiding a control is insufficient authorization.

## Complete frontend source inventory

### eslint.config.js

[D:/AdvocaNote/advocanote-frontend/eslint.config.js](../../advocanote-frontend/eslint.config.js)

JavaScript static-check configuration. **If removed:** The project loses its defined lint checks.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint/config`, `globals`
- **Declarations and study starting lines:** No static match.
- **Hook call locations:** No static match.
- **Direct API/helper calls:** No static match.

### index.html

[D:/AdvocaNote/advocanote-frontend/index.html](../../advocanote-frontend/index.html)

Configuration or supporting source for index. **If removed:** Its related build, package, or tool boundary loses this input.

- **Local dependencies:** [advocanote-frontend/src/main.jsx](../../advocanote-frontend/src/main.jsx)
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### package-lock.json

[D:/AdvocaNote/advocanote-frontend/package-lock.json](../../advocanote-frontend/package-lock.json)

Resolved frontend dependency tree. **If removed:** Npm cannot reproduce these exact resolutions from the lock.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### package.json

[D:/AdvocaNote/advocanote-frontend/package.json](../../advocanote-frontend/package.json)

Frontend package, scripts and dependency contract. **If removed:** Npm loses the build and dependency configuration.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### README.md

[D:/AdvocaNote/advocanote-frontend/README.md](../../advocanote-frontend/README.md)

Configuration or supporting source for README. **If removed:** Its related build, package, or tool boundary loses this input.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AdminDashboard.css

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminDashboard.css](../../advocanote-frontend/src/admin/AdminDashboard.css)

CSS for Admin Dashboard. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/admin/AdminDashboard.jsx](../../advocanote-frontend/src/admin/AdminDashboard.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AdminDashboard.jsx

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminDashboard.jsx](../../advocanote-frontend/src/admin/AdminDashboard.jsx)

Staff component for Admin Dashboard. **If removed:** The consuming admin screen loses this functionality.

- **Local dependencies:** [advocanote-frontend/src/admin/AdminDashboard.css](../../advocanote-frontend/src/admin/AdminDashboard.css)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [formatCount](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L45), [formatMoney](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L55), [compactMoney](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L75), [formatDate](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L91), [initials](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L105), [StatusBadge](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L117), [buildChart](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L131), [RevenueChart](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L222), [adaptSubscriptionOverview](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L363), [AdminDashboard](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L580)
- **Hook call locations:** `useState` [581](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L581), [582](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L582), [583](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L583), [584](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L584), [585](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L585), [586](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L586), `useEffect` [588](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L588), `useMemo` [223](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L223)
- **Direct API/helper calls:** [615](../../advocanote-frontend/src/admin/AdminDashboard.jsx#L615)

### AdminLawyers.css

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminLawyers.css](../../advocanote-frontend/src/admin/AdminLawyers.css)

CSS for Admin Lawyers. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/admin/AdminLawyers.jsx](../../advocanote-frontend/src/admin/AdminLawyers.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AdminLawyers.jsx

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminLawyers.jsx](../../advocanote-frontend/src/admin/AdminLawyers.jsx)

Staff component for Admin Lawyers. **If removed:** The consuming admin screen loses this functionality.

- **Local dependencies:** [advocanote-frontend/src/admin/AdminLawyers.css](../../advocanote-frontend/src/admin/AdminLawyers.css)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`
- **Declarations and study starting lines:** [formatDate](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L30), [getInitials](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L46), [getStatus](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L57), [getStatusLabel](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L72), [getVerification](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L83), [DetailItem](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L94), [AdminLawyers](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L103)
- **Hook call locations:** `useState` [104](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L104), [109](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L109), [110](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L110), [111](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L111), [112](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L112), [114](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L114), [115](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L115), [118](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L118), [120](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L120), [121](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L121), [123](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L123), [124](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L124) (+1 more), `useEffect` [129](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L129), [323](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L323), [508](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L508), `useMemo` [255](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L255)
- **Direct API/helper calls:** [147](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L147), [173](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L173), [437](../../advocanote-frontend/src/admin/AdminLawyers.jsx#L437)

### AdminLayout.css

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminLayout.css](../../advocanote-frontend/src/admin/AdminLayout.css)

CSS for Admin Layout. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/admin/AdminLayout.jsx](../../advocanote-frontend/src/admin/AdminLayout.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AdminLayout.jsx

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminLayout.jsx](../../advocanote-frontend/src/admin/AdminLayout.jsx)

Staff component for Admin Layout. **If removed:** The consuming admin screen loses this functionality.

- **Local dependencies:** [advocanote-frontend/src/admin/AdminLayout.css](../../advocanote-frontend/src/admin/AdminLayout.css), [advocanote-frontend/src/admin/AdminSidebar.jsx](../../advocanote-frontend/src/admin/AdminSidebar.jsx), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [AdminLayout](../../advocanote-frontend/src/admin/AdminLayout.jsx#L57)
- **Hook call locations:** `useState` [61](../../advocanote-frontend/src/admin/AdminLayout.jsx#L61), [62](../../advocanote-frontend/src/admin/AdminLayout.jsx#L62), [63](../../advocanote-frontend/src/admin/AdminLayout.jsx#L63), [64](../../advocanote-frontend/src/admin/AdminLayout.jsx#L64), [65](../../advocanote-frontend/src/admin/AdminLayout.jsx#L65), [66](../../advocanote-frontend/src/admin/AdminLayout.jsx#L66), [72](../../advocanote-frontend/src/admin/AdminLayout.jsx#L72), `useEffect` [74](../../advocanote-frontend/src/admin/AdminLayout.jsx#L74), [90](../../advocanote-frontend/src/admin/AdminLayout.jsx#L90), [99](../../advocanote-frontend/src/admin/AdminLayout.jsx#L99), `useNavigate` [58](../../advocanote-frontend/src/admin/AdminLayout.jsx#L58), `useLocation` [59](../../advocanote-frontend/src/admin/AdminLayout.jsx#L59)
- **Direct API/helper calls:** [119](../../advocanote-frontend/src/admin/AdminLayout.jsx#L119), [232](../../advocanote-frontend/src/admin/AdminLayout.jsx#L232)

### AdminNotifications.css

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminNotifications.css](../../advocanote-frontend/src/admin/AdminNotifications.css)

CSS for Admin Notifications. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/admin/AdminNotifications.jsx](../../advocanote-frontend/src/admin/AdminNotifications.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AdminNotifications.jsx

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminNotifications.jsx](../../advocanote-frontend/src/admin/AdminNotifications.jsx)

Staff component for Admin Notifications. **If removed:** The consuming admin screen loses this functionality.

- **Local dependencies:** [advocanote-frontend/src/admin/AdminNotifications.css](../../advocanote-frontend/src/admin/AdminNotifications.css)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`
- **Declarations and study starting lines:** [normalizeDetails](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L71), [normalizeNotification](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L102), [formatDate](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L114), [adminNotificationRequest](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L134), [AdminNotifications](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L187)
- **Hook call locations:** `useState` [189](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L189), [191](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L191), [192](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L192), [193](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L193), [196](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L196), [198](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L198), [200](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L200), [203](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L203), [205](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L205), `useEffect` [246](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L246), [311](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L311), `useMemo` [277](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L277), `useCallback` [211](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L211)
- **Direct API/helper calls:** [154](../../advocanote-frontend/src/admin/AdminNotifications.jsx#L154)

### AdminPlanManager.css

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminPlanManager.css](../../advocanote-frontend/src/admin/AdminPlanManager.css)

CSS for Admin Plan Manager. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/admin/AdminPlanManager.jsx](../../advocanote-frontend/src/admin/AdminPlanManager.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AdminPlanManager.jsx

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminPlanManager.jsx](../../advocanote-frontend/src/admin/AdminPlanManager.jsx)

Staff component for Admin Plan Manager. **If removed:** The consuming admin screen loses this functionality.

- **Local dependencies:** [advocanote-frontend/src/admin/AdminPlanManager.css](../../advocanote-frontend/src/admin/AdminPlanManager.css)
- **Static importers:** [advocanote-frontend/src/admin/AdminSubscriptions.jsx](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx)
- **External or unresolved imports:** `lucide-react`, `react`
- **Declarations and study starting lines:** [emptyForm](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L25), [money](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L45), [billingLabel](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L56), [dailyLimitLabel](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L62), [parseFeatures](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L70), [errorText](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L85), [adminRequest](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L118), [AdminPlanManager](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L169)
- **Hook call locations:** `useState` [174](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L174), [175](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L175), [176](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L176), [178](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L178), [179](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L179), [180](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L180), [181](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L181), [183](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L183)
- **Direct API/helper calls:** [132](../../advocanote-frontend/src/admin/AdminPlanManager.jsx#L132)

### AdminRoute.jsx

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminRoute.jsx](../../advocanote-frontend/src/admin/AdminRoute.jsx)

Admin role check on route entry. **If removed:** Admin navigation loses its client guard.

- **Local dependencies:** [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `react`, `react-router-dom`
- **Declarations and study starting lines:** [AdminRoute](../../advocanote-frontend/src/admin/AdminRoute.jsx#L6)
- **Hook call locations:** `useState` [7](../../advocanote-frontend/src/admin/AdminRoute.jsx#L7), `useEffect` [9](../../advocanote-frontend/src/admin/AdminRoute.jsx#L9)
- **Direct API/helper calls:** No static match.

### AdminSettings.css

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminSettings.css](../../advocanote-frontend/src/admin/AdminSettings.css)

CSS for Admin Settings. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/admin/AdminSettings.jsx](../../advocanote-frontend/src/admin/AdminSettings.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AdminSettings.jsx

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminSettings.jsx](../../advocanote-frontend/src/admin/AdminSettings.jsx)

Staff component for Admin Settings. **If removed:** The consuming admin screen loses this functionality.

- **Local dependencies:** [advocanote-frontend/src/admin/AdminSettings.css](../../advocanote-frontend/src/admin/AdminSettings.css)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`
- **Declarations and study starting lines:** [adminSettingsRequest](../../advocanote-frontend/src/admin/AdminSettings.jsx#L31), [AdminSettings](../../advocanote-frontend/src/admin/AdminSettings.jsx#L108)
- **Hook call locations:** `useState` [109](../../advocanote-frontend/src/admin/AdminSettings.jsx#L109), [114](../../advocanote-frontend/src/admin/AdminSettings.jsx#L114), [120](../../advocanote-frontend/src/admin/AdminSettings.jsx#L120), [123](../../advocanote-frontend/src/admin/AdminSettings.jsx#L123), [126](../../advocanote-frontend/src/admin/AdminSettings.jsx#L126), [129](../../advocanote-frontend/src/admin/AdminSettings.jsx#L129), [131](../../advocanote-frontend/src/admin/AdminSettings.jsx#L131), [134](../../advocanote-frontend/src/admin/AdminSettings.jsx#L134), [136](../../advocanote-frontend/src/admin/AdminSettings.jsx#L136), [138](../../advocanote-frontend/src/admin/AdminSettings.jsx#L138), `useEffect` [148](../../advocanote-frontend/src/admin/AdminSettings.jsx#L148)
- **Direct API/helper calls:** [48](../../advocanote-frontend/src/admin/AdminSettings.jsx#L48)

### AdminSidebar.css

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminSidebar.css](../../advocanote-frontend/src/admin/AdminSidebar.css)

CSS for Admin Sidebar. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/admin/AdminSidebar.jsx](../../advocanote-frontend/src/admin/AdminSidebar.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AdminSidebar.jsx

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminSidebar.jsx](../../advocanote-frontend/src/admin/AdminSidebar.jsx)

Staff component for Admin Sidebar. **If removed:** The consuming admin screen loses this functionality.

- **Local dependencies:** [advocanote-frontend/src/admin/AdminSidebar.css](../../advocanote-frontend/src/admin/AdminSidebar.css)
- **Static importers:** [advocanote-frontend/src/admin/AdminLayout.jsx](../../advocanote-frontend/src/admin/AdminLayout.jsx)
- **External or unresolved imports:** `lucide-react`, `react-router-dom`
- **Declarations and study starting lines:** [AdminSidebar](../../advocanote-frontend/src/admin/AdminSidebar.jsx#L45)
- **Hook call locations:** `useNavigate` [50](../../advocanote-frontend/src/admin/AdminSidebar.jsx#L50), `useLocation` [51](../../advocanote-frontend/src/admin/AdminSidebar.jsx#L51)
- **Direct API/helper calls:** No static match.

### AdminSubscriptions.css

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminSubscriptions.css](../../advocanote-frontend/src/admin/AdminSubscriptions.css)

CSS for Admin Subscriptions. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/admin/AdminSubscriptions.jsx](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AdminSubscriptions.jsx

[D:/AdvocaNote/advocanote-frontend/src/admin/AdminSubscriptions.jsx](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx)

Staff component for Admin Subscriptions. **If removed:** The consuming admin screen loses this functionality.

- **Local dependencies:** [advocanote-frontend/src/admin/AdminPlanManager.jsx](../../advocanote-frontend/src/admin/AdminPlanManager.jsx), [advocanote-frontend/src/admin/AdminSubscriptions.css](../../advocanote-frontend/src/admin/AdminSubscriptions.css)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`
- **Declarations and study starting lines:** [getAdminToken](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L30), [normalizeStatus](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L40), [formatStatus](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L46), [StatusBadge](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L54), [getPaymentAmount](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L64), [formatMoney](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L82), [parseBackendDate](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L107), [formatDate](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L126), [monthKey](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L139), [isPaidPayment](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L160), [getLawyerName](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L166), [getLawyerSubscription](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L181), [getSubscriptionEnd](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L185), [displayPlanName](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L195), [PlanTag](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L206), [Pager](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L231), [RevenueChart](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L269), [AdminSubscriptions](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L445)
- **Hook call locations:** `useState` [446](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L446), [449](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L449), [452](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L452), [455](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L455), [458](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L458), [461](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L461), [464](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L464), [467](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L467), `useEffect` [473](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L473), `useMemo` [270](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L270), [587](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L587), [599](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L599), [625](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L625), [638](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L638), [655](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L655), [742](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L742), [802](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L802)
- **Direct API/helper calls:** [495](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx#L495)

### App.css

[D:/AdvocaNote/advocanote-frontend/src/App.css](../../advocanote-frontend/src/App.css)

CSS for App. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### App.jsx

[D:/AdvocaNote/advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)

Route tree and cross-tab auth listener. **If removed:** The normal public, lawyer and admin routes would not render.

- **Local dependencies:** [advocanote-frontend/src/admin/AdminDashboard.jsx](../../advocanote-frontend/src/admin/AdminDashboard.jsx), [advocanote-frontend/src/admin/AdminLawyers.jsx](../../advocanote-frontend/src/admin/AdminLawyers.jsx), [advocanote-frontend/src/admin/AdminLayout.jsx](../../advocanote-frontend/src/admin/AdminLayout.jsx), [advocanote-frontend/src/admin/AdminNotifications.jsx](../../advocanote-frontend/src/admin/AdminNotifications.jsx), [advocanote-frontend/src/admin/AdminRoute.jsx](../../advocanote-frontend/src/admin/AdminRoute.jsx), [advocanote-frontend/src/admin/AdminSettings.jsx](../../advocanote-frontend/src/admin/AdminSettings.jsx), [advocanote-frontend/src/admin/AdminSubscriptions.jsx](../../advocanote-frontend/src/admin/AdminSubscriptions.jsx), [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/components/ProtectedRoute.jsx](../../advocanote-frontend/src/components/ProtectedRoute.jsx), [advocanote-frontend/src/pages/AddDiaryEntry.jsx](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx), [advocanote-frontend/src/pages/AISuggestions.jsx](../../advocanote-frontend/src/pages/AISuggestions.jsx), [advocanote-frontend/src/pages/Calendar.jsx](../../advocanote-frontend/src/pages/Calendar.jsx), [advocanote-frontend/src/pages/DiaryEntryDetails.jsx](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx), [advocanote-frontend/src/pages/ForgotPassword.jsx](../../advocanote-frontend/src/pages/ForgotPassword.jsx), [advocanote-frontend/src/pages/Hearings.jsx](../../advocanote-frontend/src/pages/Hearings.jsx), [advocanote-frontend/src/pages/Home.jsx](../../advocanote-frontend/src/pages/Home.jsx), [advocanote-frontend/src/pages/Login.jsx](../../advocanote-frontend/src/pages/Login.jsx), [advocanote-frontend/src/pages/MyCases.jsx](../../advocanote-frontend/src/pages/MyCases.jsx), [advocanote-frontend/src/pages/MyLegalDiary.jsx](../../advocanote-frontend/src/pages/MyLegalDiary.jsx), [advocanote-frontend/src/pages/Profile.jsx](../../advocanote-frontend/src/pages/Profile.jsx), [advocanote-frontend/src/pages/Register.jsx](../../advocanote-frontend/src/pages/Register.jsx), [advocanote-frontend/src/pages/RejoinAccount.jsx](../../advocanote-frontend/src/pages/RejoinAccount.jsx), [advocanote-frontend/src/pages/ResetPassword.jsx](../../advocanote-frontend/src/pages/ResetPassword.jsx), [advocanote-frontend/src/pages/Subscription.jsx](../../advocanote-frontend/src/pages/Subscription.jsx), [advocanote-frontend/src/pages/TasksPremium.jsx](../../advocanote-frontend/src/pages/TasksPremium.jsx), [advocanote-frontend/src/pages/VerifyEmail.jsx](../../advocanote-frontend/src/pages/VerifyEmail.jsx)
- **Static importers:** [advocanote-frontend/src/main.jsx](../../advocanote-frontend/src/main.jsx)
- **External or unresolved imports:** `react`, `react-router-dom`
- **Declarations and study starting lines:** [App](../../advocanote-frontend/src/App.jsx#L62)
- **Hook call locations:** `useEffect` [64](../../advocanote-frontend/src/App.jsx#L64)
- **Direct API/helper calls:** No static match.

### DiarySavedAIAndVoice.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx)

Reusable React component for Diary Saved AIAnd Voice. **If removed:** Its importing views lose the control or layout.

- **Local dependencies:** [advocanote-frontend/src/components/StructuredLegalNotes.jsx](../../advocanote-frontend/src/components/StructuredLegalNotes.jsx)
- **Static importers:** [advocanote-frontend/src/pages/CaseDetails.jsx](../../advocanote-frontend/src/pages/CaseDetails.jsx), [advocanote-frontend/src/pages/DiaryEntryDetails.jsx](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx)
- **External or unresolved imports:** `react`
- **Declarations and study starting lines:** [DiarySavedAIAndVoice](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx#L10)
- **Hook call locations:** `useState` [14](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx#L14), [15](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx#L15), [16](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx#L16), [17](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx#L17), `useEffect` [26](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx#L26), `useRef` [19](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx#L19), [20](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx#L20)
- **Direct API/helper calls:** [58](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx#L58), [134](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx#L134)

### DiaryVoiceDetails.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/DiaryVoiceDetails.jsx](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx)

Reusable React component for Diary Voice Details. **If removed:** Its importing views lose the control or layout.

- **Local dependencies:** [advocanote-frontend/src/components/StructuredLegalNotes.jsx](../../advocanote-frontend/src/components/StructuredLegalNotes.jsx)
- **Static importers:** [advocanote-frontend/src/pages/CaseDetails.jsx](../../advocanote-frontend/src/pages/CaseDetails.jsx), [advocanote-frontend/src/pages/DiaryEntryDetails.jsx](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx)
- **External or unresolved imports:** `lucide-react`, `react`
- **Declarations and study starting lines:** [NoteList](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx#L24), [DiaryVoiceDetails](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx#L32)
- **Hook call locations:** `useState` [35](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx#L35), [36](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx#L36), [38](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx#L38), [39](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx#L39), `useEffect` [45](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx#L45)
- **Direct API/helper calls:** [77](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx#L77), [111](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx#L111)

### FirstLoginOnboarding.css

[D:/AdvocaNote/advocanote-frontend/src/components/FirstLoginOnboarding.css](../../advocanote-frontend/src/components/FirstLoginOnboarding.css)

CSS for First Login Onboarding. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/components/FirstLoginOnboarding.jsx](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### FirstLoginOnboarding.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/FirstLoginOnboarding.jsx](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx)

Reusable React component for First Login Onboarding. **If removed:** Its importing views lose the control or layout.

- **Local dependencies:** [advocanote-frontend/src/components/FirstLoginOnboarding.css](../../advocanote-frontend/src/components/FirstLoginOnboarding.css), [advocanote-frontend/src/services/onboardingApi.js](../../advocanote-frontend/src/services/onboardingApi.js)
- **Static importers:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx)
- **External or unresolved imports:** `lucide-react`, `react`
- **Declarations and study starting lines:** [FirstLoginOnboarding](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx#L48)
- **Hook call locations:** `useState` [49](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx#L49), [50](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx#L50), [51](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx#L51), [52](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx#L52), [53](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx#L53), [54](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx#L54), [55](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx#L55), [56](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx#L56), `useEffect` [62](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx#L62), [124](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx#L124)
- **Direct API/helper calls:** No static match.

### LawyerLayout.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx)

Lawyer navigation, outlet, subscription gate and onboarding. **If removed:** Lawyer pages lose their shared shell.

- **Local dependencies:** [advocanote-frontend/src/components/FirstLoginOnboarding.jsx](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx), [advocanote-frontend/src/components/LawyerSidebar.jsx](../../advocanote-frontend/src/components/LawyerSidebar.jsx), [advocanote-frontend/src/components/LawyerSidebarResponsive.css](../../advocanote-frontend/src/components/LawyerSidebarResponsive.css), [advocanote-frontend/src/components/LawyerUnifiedTopbar.css](../../advocanote-frontend/src/components/LawyerUnifiedTopbar.css), [advocanote-frontend/src/components/NotificationBell.jsx](../../advocanote-frontend/src/components/NotificationBell.jsx), [advocanote-frontend/src/components/ProfileAvatar.jsx](../../advocanote-frontend/src/components/ProfileAvatar.jsx), [advocanote-frontend/src/components/SubscriptionGate.jsx](../../advocanote-frontend/src/components/SubscriptionGate.jsx), [advocanote-frontend/src/components/Toast.jsx](../../advocanote-frontend/src/components/Toast.jsx), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx), [advocanote-frontend/src/components/NotificationBell.jsx](../../advocanote-frontend/src/components/NotificationBell.jsx), [advocanote-frontend/src/pages/AddDiaryEntry.jsx](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx), [advocanote-frontend/src/pages/AISuggestions.jsx](../../advocanote-frontend/src/pages/AISuggestions.jsx), [advocanote-frontend/src/pages/Calendar.jsx](../../advocanote-frontend/src/pages/Calendar.jsx), [advocanote-frontend/src/pages/DiaryEntryDetails.jsx](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx), [advocanote-frontend/src/pages/Hearings.jsx](../../advocanote-frontend/src/pages/Hearings.jsx), [advocanote-frontend/src/pages/MyCases.jsx](../../advocanote-frontend/src/pages/MyCases.jsx), [advocanote-frontend/src/pages/MyLegalDiary.jsx](../../advocanote-frontend/src/pages/MyLegalDiary.jsx), [advocanote-frontend/src/pages/Profile.jsx](../../advocanote-frontend/src/pages/Profile.jsx), [advocanote-frontend/src/pages/Subscription.jsx](../../advocanote-frontend/src/pages/Subscription.jsx), [advocanote-frontend/src/pages/TasksPremium.jsx](../../advocanote-frontend/src/pages/TasksPremium.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-dom`, `react-router-dom`
- **Declarations and study starting lines:** [useLawyerLayout](../../advocanote-frontend/src/components/LawyerLayout.jsx#L56), [findSearchInput](../../advocanote-frontend/src/components/LawyerLayout.jsx#L69), [LawyerLayout](../../advocanote-frontend/src/components/LawyerLayout.jsx#L102), [LawyerTopbarPortal](../../advocanote-frontend/src/components/LawyerLayout.jsx#L463), [LawyerTopbarAvatar](../../advocanote-frontend/src/components/LawyerLayout.jsx#L482)
- **Hook call locations:** `useState` [108](../../advocanote-frontend/src/components/LawyerLayout.jsx#L108), [109](../../advocanote-frontend/src/components/LawyerLayout.jsx#L109), [111](../../advocanote-frontend/src/components/LawyerLayout.jsx#L111), [113](../../advocanote-frontend/src/components/LawyerLayout.jsx#L113), [115](../../advocanote-frontend/src/components/LawyerLayout.jsx#L115), [116](../../advocanote-frontend/src/components/LawyerLayout.jsx#L116), `useEffect` [124](../../advocanote-frontend/src/components/LawyerLayout.jsx#L124), [234](../../advocanote-frontend/src/components/LawyerLayout.jsx#L234), [240](../../advocanote-frontend/src/components/LawyerLayout.jsx#L240), `useRef` [106](../../advocanote-frontend/src/components/LawyerLayout.jsx#L106), `useMemo` [310](../../advocanote-frontend/src/components/LawyerLayout.jsx#L310), `useCallback` [119](../../advocanote-frontend/src/components/LawyerLayout.jsx#L119), `useNavigate` [103](../../advocanote-frontend/src/components/LawyerLayout.jsx#L103), `useLocation` [104](../../advocanote-frontend/src/components/LawyerLayout.jsx#L104)
- **Direct API/helper calls:** [139](../../advocanote-frontend/src/components/LawyerLayout.jsx#L139)

### LawyerSidebar.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/LawyerSidebar.jsx](../../advocanote-frontend/src/components/LawyerSidebar.jsx)

Reusable React component for Lawyer Sidebar. **If removed:** Its importing views lose the control or layout.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx)
- **External or unresolved imports:** `lucide-react`, `react-router-dom`
- **Declarations and study starting lines:** [LawyerSidebar](../../advocanote-frontend/src/components/LawyerSidebar.jsx#L58)
- **Hook call locations:** `useNavigate` [63](../../advocanote-frontend/src/components/LawyerSidebar.jsx#L63), `useLocation` [64](../../advocanote-frontend/src/components/LawyerSidebar.jsx#L64)
- **Direct API/helper calls:** No static match.

### LawyerSidebarResponsive.css

[D:/AdvocaNote/advocanote-frontend/src/components/LawyerSidebarResponsive.css](../../advocanote-frontend/src/components/LawyerSidebarResponsive.css)

CSS for Lawyer Sidebar Responsive. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### LawyerUnifiedTopbar.css

[D:/AdvocaNote/advocanote-frontend/src/components/LawyerUnifiedTopbar.css](../../advocanote-frontend/src/components/LawyerUnifiedTopbar.css)

CSS for Lawyer Unified Topbar. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### Navbar.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/Navbar.jsx](../../advocanote-frontend/src/components/Navbar.jsx)

Reusable React component for Navbar. **If removed:** Its importing views lose the control or layout.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `react`
- **Declarations and study starting lines:** [Navbar](../../advocanote-frontend/src/components/Navbar.jsx#L12)
- **Hook call locations:** `useState` [13](../../advocanote-frontend/src/components/Navbar.jsx#L13)
- **Direct API/helper calls:** No static match.

### NotificationBell.css

[D:/AdvocaNote/advocanote-frontend/src/components/NotificationBell.css](../../advocanote-frontend/src/components/NotificationBell.css)

CSS for Notification Bell. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/components/NotificationBell.jsx](../../advocanote-frontend/src/components/NotificationBell.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### NotificationBell.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/NotificationBell.jsx](../../advocanote-frontend/src/components/NotificationBell.jsx)

Reusable React component for Notification Bell. **If removed:** Its importing views lose the control or layout.

- **Local dependencies:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/components/NotificationBell.css](../../advocanote-frontend/src/components/NotificationBell.css)
- **Static importers:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/pages/Profile.jsx](../../advocanote-frontend/src/pages/Profile.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [notificationRequest](../../advocanote-frontend/src/components/NotificationBell.jsx#L34), [getNotificationType](../../advocanote-frontend/src/components/NotificationBell.jsx#L69), [formatReminderDate](../../advocanote-frontend/src/components/NotificationBell.jsx#L92), [getNotificationMeta](../../advocanote-frontend/src/components/NotificationBell.jsx#L123), [NotificationBell](../../advocanote-frontend/src/components/NotificationBell.jsx#L147)
- **Hook call locations:** `useState` [154](../../advocanote-frontend/src/components/NotificationBell.jsx#L154), [155](../../advocanote-frontend/src/components/NotificationBell.jsx#L155), [157](../../advocanote-frontend/src/components/NotificationBell.jsx#L157), [158](../../advocanote-frontend/src/components/NotificationBell.jsx#L158), [159](../../advocanote-frontend/src/components/NotificationBell.jsx#L159), [160](../../advocanote-frontend/src/components/NotificationBell.jsx#L160), [162](../../advocanote-frontend/src/components/NotificationBell.jsx#L162), [163](../../advocanote-frontend/src/components/NotificationBell.jsx#L163), [164](../../advocanote-frontend/src/components/NotificationBell.jsx#L164), `useEffect` [173](../../advocanote-frontend/src/components/NotificationBell.jsx#L173), [241](../../advocanote-frontend/src/components/NotificationBell.jsx#L241), [248](../../advocanote-frontend/src/components/NotificationBell.jsx#L248), `useRef` [152](../../advocanote-frontend/src/components/NotificationBell.jsx#L152), `useMemo` [166](../../advocanote-frontend/src/components/NotificationBell.jsx#L166), `useNavigate` [149](../../advocanote-frontend/src/components/NotificationBell.jsx#L149), `useLocation` [150](../../advocanote-frontend/src/components/NotificationBell.jsx#L150)
- **Direct API/helper calls:** [43](../../advocanote-frontend/src/components/NotificationBell.jsx#L43)

### NotificationDropdown.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/NotificationDropdown.jsx](../../advocanote-frontend/src/components/NotificationDropdown.jsx)

Reusable React component for Notification Dropdown. **If removed:** Its importing views lose the control or layout.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.
- **Hook call locations:** No static match.
- **Direct API/helper calls:** No static match.

### ProfileAvatar.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/ProfileAvatar.jsx](../../advocanote-frontend/src/components/ProfileAvatar.jsx)

Reusable React component for Profile Avatar. **If removed:** Its importing views lose the control or layout.

- **Local dependencies:** [advocanote-frontend/src/services/profileApi.js](../../advocanote-frontend/src/services/profileApi.js)
- **Static importers:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx)
- **External or unresolved imports:** `react`
- **Declarations and study starting lines:** [getPhotoCache](../../advocanote-frontend/src/components/ProfileAvatar.jsx#L17), [fetchSharedPhoto](../../advocanote-frontend/src/components/ProfileAvatar.jsx#L30), [ProfileAvatar](../../advocanote-frontend/src/components/ProfileAvatar.jsx#L87)
- **Hook call locations:** `useState` [96](../../advocanote-frontend/src/components/ProfileAvatar.jsx#L96), `useEffect` [119](../../advocanote-frontend/src/components/ProfileAvatar.jsx#L119)
- **Direct API/helper calls:** No static match.

### ProtectedRoute.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/ProtectedRoute.jsx](../../advocanote-frontend/src/components/ProtectedRoute.jsx)

Lawyer route check and redirects. **If removed:** Client routes lose their navigation guard; server authorization is separate.

- **Local dependencies:** [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `react`, `react-router-dom`
- **Declarations and study starting lines:** [ProtectedRoute](../../advocanote-frontend/src/components/ProtectedRoute.jsx#L7)
- **Hook call locations:** `useState` [8](../../advocanote-frontend/src/components/ProtectedRoute.jsx#L8), `useEffect` [10](../../advocanote-frontend/src/components/ProtectedRoute.jsx#L10)
- **Direct API/helper calls:** No static match.

### StructuredLegalNotes.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/StructuredLegalNotes.jsx](../../advocanote-frontend/src/components/StructuredLegalNotes.jsx)

Reusable React component for Structured Legal Notes. **If removed:** Its importing views lose the control or layout.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx), [advocanote-frontend/src/components/DiaryVoiceDetails.jsx](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx), [advocanote-frontend/src/pages/AddDiaryEntry.jsx](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** [StructuredLegalNotes](../../advocanote-frontend/src/components/StructuredLegalNotes.jsx#L2)
- **Hook call locations:** No static match.
- **Direct API/helper calls:** No static match.

### SubscriptionBilling.css

[D:/AdvocaNote/advocanote-frontend/src/components/SubscriptionBilling.css](../../advocanote-frontend/src/components/SubscriptionBilling.css)

CSS for Subscription Billing. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/components/SubscriptionBilling.jsx](../../advocanote-frontend/src/components/SubscriptionBilling.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### SubscriptionBilling.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/SubscriptionBilling.jsx](../../advocanote-frontend/src/components/SubscriptionBilling.jsx)

Reusable React component for Subscription Billing. **If removed:** Its importing views lose the control or layout.

- **Local dependencies:** [advocanote-frontend/src/components/SubscriptionBilling.css](../../advocanote-frontend/src/components/SubscriptionBilling.css)
- **Static importers:** [advocanote-frontend/src/pages/Profile.jsx](../../advocanote-frontend/src/pages/Profile.jsx)
- **External or unresolved imports:** `react`
- **Declarations and study starting lines:** [billingRequest](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L10), [formatDate](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L45), [formatPrice](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L61), [getStatusLabel](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L84), [SubscriptionBilling](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L106)
- **Hook call locations:** `useState` [108](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L108), [110](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L110), [111](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L111), [112](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L112), [114](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L114), [116](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L116), `useEffect` [144](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L144)
- **Direct API/helper calls:** [19](../../advocanote-frontend/src/components/SubscriptionBilling.jsx#L19)

### SubscriptionGate.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/SubscriptionGate.jsx](../../advocanote-frontend/src/components/SubscriptionGate.jsx)

Dashboard subscription/usage check and recovery overlay. **If removed:** Trial, limit and payment notifications lose their client entry point.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [getPlanDetails](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L39), [getToken](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L61), [apiRequest](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L71), [dailyLimitReached](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L131), [requiresSubscription](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L146), [SubscriptionGate](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L177)
- **Hook call locations:** `useState` [179](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L179), [181](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L181), [189](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L189), [191](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L191), [193](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L193), `useEffect` [199](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L199), [324](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L324), `useNavigate` [178](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L178)
- **Direct API/helper calls:** [71](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L71), [84](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L84), [208](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L208), [378](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L378), [450](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L450), [499](../../advocanote-frontend/src/components/SubscriptionGate.jsx#L499)

### Toast.css

[D:/AdvocaNote/advocanote-frontend/src/components/Toast.css](../../advocanote-frontend/src/components/Toast.css)

CSS for Toast. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/components/Toast.jsx](../../advocanote-frontend/src/components/Toast.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### Toast.jsx

[D:/AdvocaNote/advocanote-frontend/src/components/Toast.jsx](../../advocanote-frontend/src/components/Toast.jsx)

Reusable React component for Toast. **If removed:** Its importing views lose the control or layout.

- **Local dependencies:** [advocanote-frontend/src/components/Toast.css](../../advocanote-frontend/src/components/Toast.css)
- **Static importers:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx)
- **External or unresolved imports:** `react`, `react-dom`
- **Declarations and study starting lines:** [Toast](../../advocanote-frontend/src/components/Toast.jsx#L6)
- **Hook call locations:** `useEffect` [7](../../advocanote-frontend/src/components/Toast.jsx#L7)
- **Direct API/helper calls:** No static match.

### useAdminUnreadCount.js

[D:/AdvocaNote/advocanote-frontend/src/hooks/useAdminUnreadCount.js](../../advocanote-frontend/src/hooks/useAdminUnreadCount.js)

Reusable state/effect logic for use Admin Unread Count. **If removed:** Its importing views lose the state/update behavior.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `react`
- **Declarations and study starting lines:** [useAdminUnreadCount](../../advocanote-frontend/src/hooks/useAdminUnreadCount.js#L4)
- **Hook call locations:** `useState` [5](../../advocanote-frontend/src/hooks/useAdminUnreadCount.js#L5), `useEffect` [7](../../advocanote-frontend/src/hooks/useAdminUnreadCount.js#L7)
- **Direct API/helper calls:** [29](../../advocanote-frontend/src/hooks/useAdminUnreadCount.js#L29)

### index.css

[D:/AdvocaNote/advocanote-frontend/src/index.css](../../advocanote-frontend/src/index.css)

CSS for index. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/main.jsx](../../advocanote-frontend/src/main.jsx)
- **External or unresolved imports:** `tailwindcss`
- **Declarations and study starting lines:** No static match.

### main.jsx

[D:/AdvocaNote/advocanote-frontend/src/main.jsx](../../advocanote-frontend/src/main.jsx)

Application entry point and integration composition. **If removed:** The corresponding browser or API process loses its normal starting point.

- **Local dependencies:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx), [advocanote-frontend/src/index.css](../../advocanote-frontend/src/index.css)
- **Static importers:** [advocanote-frontend/index.html](../../advocanote-frontend/index.html)
- **External or unresolved imports:** `@react-oauth/google`, `react`, `react-dom/client`
- **Declarations and study starting lines:** No static match.
- **Hook call locations:** No static match.
- **Direct API/helper calls:** No static match.

### AccountPages.css

[D:/AdvocaNote/advocanote-frontend/src/pages/AccountPages.css](../../advocanote-frontend/src/pages/AccountPages.css)

CSS for Account Pages. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/Profile.jsx](../../advocanote-frontend/src/pages/Profile.jsx), [advocanote-frontend/src/pages/Subscription.jsx](../../advocanote-frontend/src/pages/Subscription.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AddDiaryEntry.css

[D:/AdvocaNote/advocanote-frontend/src/pages/AddDiaryEntry.css](../../advocanote-frontend/src/pages/AddDiaryEntry.css)

CSS for Add Diary Entry. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/AddDiaryEntry.jsx](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AddDiaryEntry.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/AddDiaryEntry.jsx](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx)

Diary form with recording and review before submitting entries. **If removed:** The primary diary creation UI fails.

- **Local dependencies:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/components/StructuredLegalNotes.jsx](../../advocanote-frontend/src/components/StructuredLegalNotes.jsx), [advocanote-frontend/src/pages/AddDiaryEntry.css](../../advocanote-frontend/src/pages/AddDiaryEntry.css), [advocanote-frontend/src/pages/MyLegalDiary.css](../../advocanote-frontend/src/pages/MyLegalDiary.css), [advocanote-frontend/src/pages/SriLankaCourtFields.jsx](../../advocanote-frontend/src/pages/SriLankaCourtFields.jsx), [advocanote-frontend/src/services/diary.js](../../advocanote-frontend/src/services/diary.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [toISO](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L67), [fromISO](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L74), [goodISO](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L77), [emptyDraft](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L82), [MonthCalendar](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L100), [AddDiaryEntry](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L239)
- **Hook call locations:** `useState` [103](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L103), [252](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L252), [262](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L262), [264](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L264), [267](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L267), [269](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L269), [270](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L270), [271](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L271), [272](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L272), [273](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L273), [274](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L274), [275](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L275) (+15 more), `useEffect` [112](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L112), [737](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L737), [792](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L792), [886](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L886), `useRef` [329](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L329), [331](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L331), [332](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L332), [333](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L333), [335](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L335), [336](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L336), [337](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L337), [338](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L338), [342](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L342), [344](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L344), [346](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L346), [348](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L348) (+2 more), `useNavigate` [240](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L240), `useLocation` [241](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L241)
- **Direct API/helper calls:** [1422](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L1422), [1578](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L1578), [2168](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx#L2168)

### AISuggestions.css

[D:/AdvocaNote/advocanote-frontend/src/pages/AISuggestions.css](../../advocanote-frontend/src/pages/AISuggestions.css)

CSS for AISuggestions. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/AISuggestions.jsx](../../advocanote-frontend/src/pages/AISuggestions.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### AISuggestions.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/AISuggestions.jsx](../../advocanote-frontend/src/pages/AISuggestions.jsx)

React view for AISuggestions. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/pages/AISuggestions.css](../../advocanote-frontend/src/pages/AISuggestions.css)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [getStatus](../../advocanote-frontend/src/pages/AISuggestions.jsx#L45), [formatDate](../../advocanote-frontend/src/pages/AISuggestions.jsx#L53), [SuggestionStatus](../../advocanote-frontend/src/pages/AISuggestions.jsx#L69), [AISuggestions](../../advocanote-frontend/src/pages/AISuggestions.jsx#L78)
- **Hook call locations:** `useState` [83](../../advocanote-frontend/src/pages/AISuggestions.jsx#L83), [84](../../advocanote-frontend/src/pages/AISuggestions.jsx#L84), [85](../../advocanote-frontend/src/pages/AISuggestions.jsx#L85), [87](../../advocanote-frontend/src/pages/AISuggestions.jsx#L87), [88](../../advocanote-frontend/src/pages/AISuggestions.jsx#L88), [90](../../advocanote-frontend/src/pages/AISuggestions.jsx#L90), [91](../../advocanote-frontend/src/pages/AISuggestions.jsx#L91), [92](../../advocanote-frontend/src/pages/AISuggestions.jsx#L92), [93](../../advocanote-frontend/src/pages/AISuggestions.jsx#L93), [94](../../advocanote-frontend/src/pages/AISuggestions.jsx#L94), [95](../../advocanote-frontend/src/pages/AISuggestions.jsx#L95), `useEffect` [171](../../advocanote-frontend/src/pages/AISuggestions.jsx#L171), [236](../../advocanote-frontend/src/pages/AISuggestions.jsx#L236), [242](../../advocanote-frontend/src/pages/AISuggestions.jsx#L242), [279](../../advocanote-frontend/src/pages/AISuggestions.jsx#L279), `useMemo` [181](../../advocanote-frontend/src/pages/AISuggestions.jsx#L181), [199](../../advocanote-frontend/src/pages/AISuggestions.jsx#L199), [228](../../advocanote-frontend/src/pages/AISuggestions.jsx#L228), `useCallback` [99](../../advocanote-frontend/src/pages/AISuggestions.jsx#L99), `useNavigate` [79](../../advocanote-frontend/src/pages/AISuggestions.jsx#L79)
- **Direct API/helper calls:** [112](../../advocanote-frontend/src/pages/AISuggestions.jsx#L112), [311](../../advocanote-frontend/src/pages/AISuggestions.jsx#L311)

### AuthLayout.css

[D:/AdvocaNote/advocanote-frontend/src/pages/AuthLayout.css](../../advocanote-frontend/src/pages/AuthLayout.css)

CSS for Auth Layout. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/ForgotPassword.jsx](../../advocanote-frontend/src/pages/ForgotPassword.jsx), [advocanote-frontend/src/pages/ResetPassword.jsx](../../advocanote-frontend/src/pages/ResetPassword.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### Calendar.css

[D:/AdvocaNote/advocanote-frontend/src/pages/Calendar.css](../../advocanote-frontend/src/pages/Calendar.css)

CSS for Calendar. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/Calendar.jsx](../../advocanote-frontend/src/pages/Calendar.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### Calendar.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/Calendar.jsx](../../advocanote-frontend/src/pages/Calendar.jsx)

React view for Calendar. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/pages/Calendar.css](../../advocanote-frontend/src/pages/Calendar.css), [advocanote-frontend/src/pages/MyLegalDiary.css](../../advocanote-frontend/src/pages/MyLegalDiary.css), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js), [advocanote-frontend/src/services/diary.js](../../advocanote-frontend/src/services/diary.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [dateKey](../../advocanote-frontend/src/pages/Calendar.jsx#L102), [parseDate](../../advocanote-frontend/src/pages/Calendar.jsx#L110), [longDate](../../advocanote-frontend/src/pages/Calendar.jsx#L116), [monthLabel](../../advocanote-frontend/src/pages/Calendar.jsx#L125), [calendarApiRequest](../../advocanote-frontend/src/pages/Calendar.jsx#L169), [calendarNormalizeList](../../advocanote-frontend/src/pages/Calendar.jsx#L211), [calendarTaskRequest](../../advocanote-frontend/src/pages/Calendar.jsx#L225), [getCalendarTasks](../../advocanote-frontend/src/pages/Calendar.jsx#L262), [Calendar](../../advocanote-frontend/src/pages/Calendar.jsx#L330)
- **Hook call locations:** `useState` [342](../../advocanote-frontend/src/pages/Calendar.jsx#L342), [343](../../advocanote-frontend/src/pages/Calendar.jsx#L343), [344](../../advocanote-frontend/src/pages/Calendar.jsx#L344), [346](../../advocanote-frontend/src/pages/Calendar.jsx#L346), [384](../../advocanote-frontend/src/pages/Calendar.jsx#L384), [417](../../advocanote-frontend/src/pages/Calendar.jsx#L417), [427](../../advocanote-frontend/src/pages/Calendar.jsx#L427), [431](../../advocanote-frontend/src/pages/Calendar.jsx#L431), [437](../../advocanote-frontend/src/pages/Calendar.jsx#L437), [439](../../advocanote-frontend/src/pages/Calendar.jsx#L439), [443](../../advocanote-frontend/src/pages/Calendar.jsx#L443), [778](../../advocanote-frontend/src/pages/Calendar.jsx#L778) (+5 more), `useEffect` [351](../../advocanote-frontend/src/pages/Calendar.jsx#L351), [386](../../advocanote-frontend/src/pages/Calendar.jsx#L386), [408](../../advocanote-frontend/src/pages/Calendar.jsx#L408), [445](../../advocanote-frontend/src/pages/Calendar.jsx#L445), [582](../../advocanote-frontend/src/pages/Calendar.jsx#L582), `useMemo` [658](../../advocanote-frontend/src/pages/Calendar.jsx#L658), [665](../../advocanote-frontend/src/pages/Calendar.jsx#L665), [748](../../advocanote-frontend/src/pages/Calendar.jsx#L748), [803](../../advocanote-frontend/src/pages/Calendar.jsx#L803), [824](../../advocanote-frontend/src/pages/Calendar.jsx#L824), `useNavigate` [335](../../advocanote-frontend/src/pages/Calendar.jsx#L335)
- **Direct API/helper calls:** [180](../../advocanote-frontend/src/pages/Calendar.jsx#L180), [236](../../advocanote-frontend/src/pages/Calendar.jsx#L236)

### CalendarCompact.css

[D:/AdvocaNote/advocanote-frontend/src/pages/CalendarCompact.css](../../advocanote-frontend/src/pages/CalendarCompact.css)

CSS for Calendar Compact. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### CaseDetails.css

[D:/AdvocaNote/advocanote-frontend/src/pages/CaseDetails.css](../../advocanote-frontend/src/pages/CaseDetails.css)

CSS for Case Details. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/CaseDetails.jsx](../../advocanote-frontend/src/pages/CaseDetails.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### CaseDetails.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/CaseDetails.jsx](../../advocanote-frontend/src/pages/CaseDetails.jsx)

React view for Case Details. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx), [advocanote-frontend/src/components/DiaryVoiceDetails.jsx](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx), [advocanote-frontend/src/pages/CaseDetails.css](../../advocanote-frontend/src/pages/CaseDetails.css), [advocanote-frontend/src/pages/CaseTasks.jsx](../../advocanote-frontend/src/pages/CaseTasks.jsx), [advocanote-frontend/src/pages/DiaryEntryDetails.css](../../advocanote-frontend/src/pages/DiaryEntryDetails.css), [advocanote-frontend/src/services/diary.js](../../advocanote-frontend/src/services/diary.js)
- **Static importers:** [advocanote-frontend/src/pages/MyCases.jsx](../../advocanote-frontend/src/pages/MyCases.jsx)
- **External or unresolved imports:** `lucide-react`, `react`
- **Declarations and study starting lines:** [textOf](../../advocanote-frontend/src/pages/CaseDetails.jsx#L33), [toPoints](../../advocanote-frontend/src/pages/CaseDetails.jsx#L35), [formatDate](../../advocanote-frontend/src/pages/CaseDetails.jsx#L43), [formatLongDate](../../advocanote-frontend/src/pages/CaseDetails.jsx#L61), [formatWeekday](../../advocanote-frontend/src/pages/CaseDetails.jsx#L77), [entryDate](../../advocanote-frontend/src/pages/CaseDetails.jsx#L91), [entryNotes](../../advocanote-frontend/src/pages/CaseDetails.jsx#L96), [entryNextDate](../../advocanote-frontend/src/pages/CaseDetails.jsx#L104), [CaseDiaryVoiceAI](../../advocanote-frontend/src/pages/CaseDetails.jsx#L107), [CaseDetails](../../advocanote-frontend/src/pages/CaseDetails.jsx#L166)
- **Hook call locations:** `useState` [108](../../advocanote-frontend/src/pages/CaseDetails.jsx#L108), [109](../../advocanote-frontend/src/pages/CaseDetails.jsx#L109), [110](../../advocanote-frontend/src/pages/CaseDetails.jsx#L110), [180](../../advocanote-frontend/src/pages/CaseDetails.jsx#L180), [181](../../advocanote-frontend/src/pages/CaseDetails.jsx#L181), [182](../../advocanote-frontend/src/pages/CaseDetails.jsx#L182), [183](../../advocanote-frontend/src/pages/CaseDetails.jsx#L183), [184](../../advocanote-frontend/src/pages/CaseDetails.jsx#L184), [185](../../advocanote-frontend/src/pages/CaseDetails.jsx#L185), [190](../../advocanote-frontend/src/pages/CaseDetails.jsx#L190), [191](../../advocanote-frontend/src/pages/CaseDetails.jsx#L191), [192](../../advocanote-frontend/src/pages/CaseDetails.jsx#L192) (+14 more), `useEffect` [112](../../advocanote-frontend/src/pages/CaseDetails.jsx#L112), [187](../../advocanote-frontend/src/pages/CaseDetails.jsx#L187), [220](../../advocanote-frontend/src/pages/CaseDetails.jsx#L220), `useMemo` [428](../../advocanote-frontend/src/pages/CaseDetails.jsx#L428), [442](../../advocanote-frontend/src/pages/CaseDetails.jsx#L442), [522](../../advocanote-frontend/src/pages/CaseDetails.jsx#L522)
- **Direct API/helper calls:** [276](../../advocanote-frontend/src/pages/CaseDetails.jsx#L276)

### CaseTasks.css

[D:/AdvocaNote/advocanote-frontend/src/pages/CaseTasks.css](../../advocanote-frontend/src/pages/CaseTasks.css)

CSS for Case Tasks. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/CaseTasks.jsx](../../advocanote-frontend/src/pages/CaseTasks.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### CaseTasks.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/CaseTasks.jsx](../../advocanote-frontend/src/pages/CaseTasks.jsx)

React view for Case Tasks. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/pages/CaseTasks.css](../../advocanote-frontend/src/pages/CaseTasks.css)
- **Static importers:** [advocanote-frontend/src/pages/CaseDetails.jsx](../../advocanote-frontend/src/pages/CaseDetails.jsx)
- **External or unresolved imports:** `lucide-react`, `react`
- **Declarations and study starting lines:** [emptyForm](../../advocanote-frontend/src/pages/CaseTasks.jsx#L28), [request](../../advocanote-frontend/src/pages/CaseTasks.jsx#L34), [formatDate](../../advocanote-frontend/src/pages/CaseTasks.jsx#L67), [todayLocal](../../advocanote-frontend/src/pages/CaseTasks.jsx#L83), [displayStatus](../../advocanote-frontend/src/pages/CaseTasks.jsx#L93), [CaseTasks](../../advocanote-frontend/src/pages/CaseTasks.jsx#L110)
- **Hook call locations:** `useState` [111](../../advocanote-frontend/src/pages/CaseTasks.jsx#L111), [112](../../advocanote-frontend/src/pages/CaseTasks.jsx#L112), [113](../../advocanote-frontend/src/pages/CaseTasks.jsx#L113), [115](../../advocanote-frontend/src/pages/CaseTasks.jsx#L115), [116](../../advocanote-frontend/src/pages/CaseTasks.jsx#L116), [117](../../advocanote-frontend/src/pages/CaseTasks.jsx#L117), [119](../../advocanote-frontend/src/pages/CaseTasks.jsx#L119), [120](../../advocanote-frontend/src/pages/CaseTasks.jsx#L120), [122](../../advocanote-frontend/src/pages/CaseTasks.jsx#L122), [123](../../advocanote-frontend/src/pages/CaseTasks.jsx#L123), [124](../../advocanote-frontend/src/pages/CaseTasks.jsx#L124), [125](../../advocanote-frontend/src/pages/CaseTasks.jsx#L125), `useEffect` [148](../../advocanote-frontend/src/pages/CaseTasks.jsx#L148), `useMemo` [154](../../advocanote-frontend/src/pages/CaseTasks.jsx#L154), `useCallback` [129](../../advocanote-frontend/src/pages/CaseTasks.jsx#L129)
- **Direct API/helper calls:** [39](../../advocanote-frontend/src/pages/CaseTasks.jsx#L39)

### DiaryEntryDetails.css

[D:/AdvocaNote/advocanote-frontend/src/pages/DiaryEntryDetails.css](../../advocanote-frontend/src/pages/DiaryEntryDetails.css)

CSS for Diary Entry Details. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/CaseDetails.jsx](../../advocanote-frontend/src/pages/CaseDetails.jsx), [advocanote-frontend/src/pages/DiaryEntryDetails.jsx](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### DiaryEntryDetails.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/DiaryEntryDetails.jsx](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx)

React view for Diary Entry Details. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx](../../advocanote-frontend/src/components/DiarySavedAIAndVoice.jsx), [advocanote-frontend/src/components/DiaryVoiceDetails.jsx](../../advocanote-frontend/src/components/DiaryVoiceDetails.jsx), [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/pages/DiaryEntryDetails.css](../../advocanote-frontend/src/pages/DiaryEntryDetails.css), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js), [advocanote-frontend/src/services/diary.js](../../advocanote-frontend/src/services/diary.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [todayISO](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L26), [formatDate](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L36), [editableDraft](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L52), [InfoField](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L60), [DiaryEntryDetails](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L69)
- **Hook call locations:** `useState` [80](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L80), [81](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L81), [83](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L83), [84](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L84), [86](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L86), [87](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L87), [88](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L88), [89](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L89), [91](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L91), [93](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L93), [94](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L94), [95](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L95) (+4 more), `useEffect` [103](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L103), [163](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L163), [182](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L182), `useRef` [77](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L77), [78](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L78), `useMemo` [206](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L206), [217](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L217), `useNavigate` [72](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L72), `useLocation` [73](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L73), `useParams` [70](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx#L70)
- **Direct API/helper calls:** No static match.

### ForgotPassword.css

[D:/AdvocaNote/advocanote-frontend/src/pages/ForgotPassword.css](../../advocanote-frontend/src/pages/ForgotPassword.css)

CSS for Forgot Password. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/ForgotPassword.jsx](../../advocanote-frontend/src/pages/ForgotPassword.jsx), [advocanote-frontend/src/pages/ResetPassword.jsx](../../advocanote-frontend/src/pages/ResetPassword.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### ForgotPassword.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/ForgotPassword.jsx](../../advocanote-frontend/src/pages/ForgotPassword.jsx)

React view for Forgot Password. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/pages/AuthLayout.css](../../advocanote-frontend/src/pages/AuthLayout.css), [advocanote-frontend/src/pages/ForgotPassword.css](../../advocanote-frontend/src/pages/ForgotPassword.css), [advocanote-frontend/src/pages/Login.css](../../advocanote-frontend/src/pages/Login.css), [advocanote-frontend/src/services/otpRecovery.js](../../advocanote-frontend/src/services/otpRecovery.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `react`, `react-router-dom`
- **Declarations and study starting lines:** [Icon](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L16), [Logo](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L95), [ForgotPassword](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L151)
- **Hook call locations:** `useState` [155](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L155), [157](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L157), [158](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L158), [159](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L159), [161](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L161), [162](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L162), [165](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L165), [166](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L166), [168](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L168), [169](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L169), `useNavigate` [152](../../advocanote-frontend/src/pages/ForgotPassword.jsx#L152)
- **Direct API/helper calls:** No static match.

### Hearings.css

[D:/AdvocaNote/advocanote-frontend/src/pages/Hearings.css](../../advocanote-frontend/src/pages/Hearings.css)

CSS for Hearings. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/Hearings.jsx](../../advocanote-frontend/src/pages/Hearings.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### Hearings.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/Hearings.jsx](../../advocanote-frontend/src/pages/Hearings.jsx)

React view for Hearings. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/pages/Hearings.css](../../advocanote-frontend/src/pages/Hearings.css), [advocanote-frontend/src/pages/MyLegalDiary.css](../../advocanote-frontend/src/pages/MyLegalDiary.css), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js), [advocanote-frontend/src/services/diary.js](../../advocanote-frontend/src/services/diary.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [todayISO](../../advocanote-frontend/src/pages/Hearings.jsx#L36), [dateISO](../../advocanote-frontend/src/pages/Hearings.jsx#L46), [formatDate](../../advocanote-frontend/src/pages/Hearings.jsx#L53), [isUpcoming](../../advocanote-frontend/src/pages/Hearings.jsx#L65), [hearingStatus](../../advocanote-frontend/src/pages/Hearings.jsx#L74), [HearingCalendar](../../advocanote-frontend/src/pages/Hearings.jsx#L89), [Hearings](../../advocanote-frontend/src/pages/Hearings.jsx#L211)
- **Hook call locations:** `useState` [90](../../advocanote-frontend/src/pages/Hearings.jsx#L90), [216](../../advocanote-frontend/src/pages/Hearings.jsx#L216), [217](../../advocanote-frontend/src/pages/Hearings.jsx#L217), [219](../../advocanote-frontend/src/pages/Hearings.jsx#L219), [220](../../advocanote-frontend/src/pages/Hearings.jsx#L220), [222](../../advocanote-frontend/src/pages/Hearings.jsx#L222), [223](../../advocanote-frontend/src/pages/Hearings.jsx#L223), [224](../../advocanote-frontend/src/pages/Hearings.jsx#L224), [226](../../advocanote-frontend/src/pages/Hearings.jsx#L226), [228](../../advocanote-frontend/src/pages/Hearings.jsx#L228), [229](../../advocanote-frontend/src/pages/Hearings.jsx#L229), [230](../../advocanote-frontend/src/pages/Hearings.jsx#L230) (+2 more), `useEffect` [238](../../advocanote-frontend/src/pages/Hearings.jsx#L238), `useMemo` [290](../../advocanote-frontend/src/pages/Hearings.jsx#L290), [317](../../advocanote-frontend/src/pages/Hearings.jsx#L317), [322](../../advocanote-frontend/src/pages/Hearings.jsx#L322), [331](../../advocanote-frontend/src/pages/Hearings.jsx#L331), [341](../../advocanote-frontend/src/pages/Hearings.jsx#L341), [352](../../advocanote-frontend/src/pages/Hearings.jsx#L352), [408](../../advocanote-frontend/src/pages/Hearings.jsx#L408), `useNavigate` [212](../../advocanote-frontend/src/pages/Hearings.jsx#L212)
- **Direct API/helper calls:** [517](../../advocanote-frontend/src/pages/Hearings.jsx#L517)

### Home.css

[D:/AdvocaNote/advocanote-frontend/src/pages/Home.css](../../advocanote-frontend/src/pages/Home.css)

CSS for Home. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/Home.jsx](../../advocanote-frontend/src/pages/Home.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### Home.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/Home.jsx](../../advocanote-frontend/src/pages/Home.jsx)

React view for Home. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/pages/Home.css](../../advocanote-frontend/src/pages/Home.css)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`
- **Declarations and study starting lines:** [Logo](../../advocanote-frontend/src/pages/Home.jsx#L254), [Eyebrow](../../advocanote-frontend/src/pages/Home.jsx#L274), [SectionTitle](../../advocanote-frontend/src/pages/Home.jsx#L286), [Home](../../advocanote-frontend/src/pages/Home.jsx#L304)
- **Hook call locations:** `useState` [305](../../advocanote-frontend/src/pages/Home.jsx#L305), [306](../../advocanote-frontend/src/pages/Home.jsx#L306), [307](../../advocanote-frontend/src/pages/Home.jsx#L307), [308](../../advocanote-frontend/src/pages/Home.jsx#L308), `useEffect` [313](../../advocanote-frontend/src/pages/Home.jsx#L313), [353](../../advocanote-frontend/src/pages/Home.jsx#L353)
- **Direct API/helper calls:** No static match.

### Login.css

[D:/AdvocaNote/advocanote-frontend/src/pages/Login.css](../../advocanote-frontend/src/pages/Login.css)

CSS for Login. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/ForgotPassword.jsx](../../advocanote-frontend/src/pages/ForgotPassword.jsx), [advocanote-frontend/src/pages/Login.jsx](../../advocanote-frontend/src/pages/Login.jsx), [advocanote-frontend/src/pages/ResetPassword.jsx](../../advocanote-frontend/src/pages/ResetPassword.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### Login.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/Login.jsx](../../advocanote-frontend/src/pages/Login.jsx)

React view for Login. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/pages/Login.css](../../advocanote-frontend/src/pages/Login.css), [advocanote-frontend/src/pages/LoginContentFix.css](../../advocanote-frontend/src/pages/LoginContentFix.css), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `@react-oauth/google`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [Icon](../../advocanote-frontend/src/pages/Login.jsx#L20), [Logo](../../advocanote-frontend/src/pages/Login.jsx#L100), [Login](../../advocanote-frontend/src/pages/Login.jsx#L139)
- **Hook call locations:** `useState` [142](../../advocanote-frontend/src/pages/Login.jsx#L142), [143](../../advocanote-frontend/src/pages/Login.jsx#L143), [144](../../advocanote-frontend/src/pages/Login.jsx#L144), [145](../../advocanote-frontend/src/pages/Login.jsx#L145), [146](../../advocanote-frontend/src/pages/Login.jsx#L146), `useEffect` [147](../../advocanote-frontend/src/pages/Login.jsx#L147), `useNavigate` [140](../../advocanote-frontend/src/pages/Login.jsx#L140)
- **Direct API/helper calls:** No static match.

### LoginContentFix.css

[D:/AdvocaNote/advocanote-frontend/src/pages/LoginContentFix.css](../../advocanote-frontend/src/pages/LoginContentFix.css)

CSS for Login Content Fix. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/Login.jsx](../../advocanote-frontend/src/pages/Login.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### MyCases.css

[D:/AdvocaNote/advocanote-frontend/src/pages/MyCases.css](../../advocanote-frontend/src/pages/MyCases.css)

CSS for My Cases. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/MyCases.jsx](../../advocanote-frontend/src/pages/MyCases.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### MyCases.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/MyCases.jsx](../../advocanote-frontend/src/pages/MyCases.jsx)

React view for My Cases. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/pages/CaseDetails.jsx](../../advocanote-frontend/src/pages/CaseDetails.jsx), [advocanote-frontend/src/pages/MyCases.css](../../advocanote-frontend/src/pages/MyCases.css), [advocanote-frontend/src/pages/MyCasesActions.css](../../advocanote-frontend/src/pages/MyCasesActions.css), [advocanote-frontend/src/pages/MyLegalDiary.css](../../advocanote-frontend/src/pages/MyLegalDiary.css), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js), [advocanote-frontend/src/services/diary.js](../../advocanote-frontend/src/services/diary.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-dom`, `react-router-dom`
- **Declarations and study starting lines:** [today](../../advocanote-frontend/src/pages/MyCases.jsx#L134), [niceDate](../../advocanote-frontend/src/pages/MyCases.jsx#L144), [clean](../../advocanote-frontend/src/pages/MyCases.jsx#L160), [statusOf](../../advocanote-frontend/src/pages/MyCases.jsx#L162), [caseTypeOf](../../advocanote-frontend/src/pages/MyCases.jsx#L165), [courtOf](../../advocanote-frontend/src/pages/MyCases.jsx#L168), [locationOf](../../advocanote-frontend/src/pages/MyCases.jsx#L171), [numberOf](../../advocanote-frontend/src/pages/MyCases.jsx#L174), [titleOf](../../advocanote-frontend/src/pages/MyCases.jsx#L177), [caseTypeLabel](../../advocanote-frontend/src/pages/MyCases.jsx#L182), [statusLabel](../../advocanote-frontend/src/pages/MyCases.jsx#L185), [authorizedRequest](../../advocanote-frontend/src/pages/MyCases.jsx#L188), [newCaseDraft](../../advocanote-frontend/src/pages/MyCases.jsx#L221), [Choice](../../advocanote-frontend/src/pages/MyCases.jsx#L235), [MyCases](../../advocanote-frontend/src/pages/MyCases.jsx#L284)
- **Hook call locations:** `useState` [291](../../advocanote-frontend/src/pages/MyCases.jsx#L291), [292](../../advocanote-frontend/src/pages/MyCases.jsx#L292), [293](../../advocanote-frontend/src/pages/MyCases.jsx#L293), [295](../../advocanote-frontend/src/pages/MyCases.jsx#L295), [296](../../advocanote-frontend/src/pages/MyCases.jsx#L296), [297](../../advocanote-frontend/src/pages/MyCases.jsx#L297), [299](../../advocanote-frontend/src/pages/MyCases.jsx#L299), [300](../../advocanote-frontend/src/pages/MyCases.jsx#L300), [302](../../advocanote-frontend/src/pages/MyCases.jsx#L302), [303](../../advocanote-frontend/src/pages/MyCases.jsx#L303), [304](../../advocanote-frontend/src/pages/MyCases.jsx#L304), [305](../../advocanote-frontend/src/pages/MyCases.jsx#L305) (+14 more), `useEffect` [332](../../advocanote-frontend/src/pages/MyCases.jsx#L332), [351](../../advocanote-frontend/src/pages/MyCases.jsx#L351), [636](../../advocanote-frontend/src/pages/MyCases.jsx#L636), [888](../../advocanote-frontend/src/pages/MyCases.jsx#L888), `useRef` [287](../../advocanote-frontend/src/pages/MyCases.jsx#L287), `useMemo` [407](../../advocanote-frontend/src/pages/MyCases.jsx#L407), [440](../../advocanote-frontend/src/pages/MyCases.jsx#L440), [450](../../advocanote-frontend/src/pages/MyCases.jsx#L450), [476](../../advocanote-frontend/src/pages/MyCases.jsx#L476), `useCallback` [600](../../advocanote-frontend/src/pages/MyCases.jsx#L600), `useNavigate` [285](../../advocanote-frontend/src/pages/MyCases.jsx#L285), `useLocation` [286](../../advocanote-frontend/src/pages/MyCases.jsx#L286)
- **Direct API/helper calls:** [193](../../advocanote-frontend/src/pages/MyCases.jsx#L193)

### MyCasesActions.css

[D:/AdvocaNote/advocanote-frontend/src/pages/MyCasesActions.css](../../advocanote-frontend/src/pages/MyCasesActions.css)

CSS for My Cases Actions. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/MyCases.jsx](../../advocanote-frontend/src/pages/MyCases.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### MyLegalDiary.css

[D:/AdvocaNote/advocanote-frontend/src/pages/MyLegalDiary.css](../../advocanote-frontend/src/pages/MyLegalDiary.css)

CSS for My Legal Diary. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/AddDiaryEntry.jsx](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx), [advocanote-frontend/src/pages/Calendar.jsx](../../advocanote-frontend/src/pages/Calendar.jsx), [advocanote-frontend/src/pages/Hearings.jsx](../../advocanote-frontend/src/pages/Hearings.jsx), [advocanote-frontend/src/pages/MyCases.jsx](../../advocanote-frontend/src/pages/MyCases.jsx), [advocanote-frontend/src/pages/MyLegalDiary.jsx](../../advocanote-frontend/src/pages/MyLegalDiary.jsx), [advocanote-frontend/src/pages/Subscription.jsx](../../advocanote-frontend/src/pages/Subscription.jsx), [advocanote-frontend/src/pages/TasksPremium.jsx](../../advocanote-frontend/src/pages/TasksPremium.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### MyLegalDiary.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/MyLegalDiary.jsx](../../advocanote-frontend/src/pages/MyLegalDiary.jsx)

React view for My Legal Diary. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/pages/MyLegalDiary.css](../../advocanote-frontend/src/pages/MyLegalDiary.css), [advocanote-frontend/src/pages/MyLegalDiaryRightPanel.css](../../advocanote-frontend/src/pages/MyLegalDiaryRightPanel.css), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js), [advocanote-frontend/src/services/diary.js](../../advocanote-frontend/src/services/diary.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [toISODate](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L27), [parseDate](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L30), [readableDate](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L32), [fullDate](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L37), [DiaryMiniCalendar](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L44), [MyLegalDiary](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L133)
- **Hook call locations:** `useState` [45](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L45), [137](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L137), [138](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L138), [139](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L139), [145](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L145), [146](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L146), [147](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L147), [148](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L148), [150](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L150), [151](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L151), [152](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L152), [153](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L153) (+13 more), `useEffect` [193](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L193), [228](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L228), [252](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L252), `useRef` [135](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L135), `useMemo` [285](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L285), [290](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L290), `useNavigate` [134](../../advocanote-frontend/src/pages/MyLegalDiary.jsx#L134)
- **Direct API/helper calls:** No static match.

### MyLegalDiaryRightPanel.css

[D:/AdvocaNote/advocanote-frontend/src/pages/MyLegalDiaryRightPanel.css](../../advocanote-frontend/src/pages/MyLegalDiaryRightPanel.css)

CSS for My Legal Diary Right Panel. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/MyLegalDiary.jsx](../../advocanote-frontend/src/pages/MyLegalDiary.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### Profile.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/Profile.jsx](../../advocanote-frontend/src/pages/Profile.jsx)

React view for Profile. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/components/NotificationBell.jsx](../../advocanote-frontend/src/components/NotificationBell.jsx), [advocanote-frontend/src/components/SubscriptionBilling.jsx](../../advocanote-frontend/src/components/SubscriptionBilling.jsx), [advocanote-frontend/src/pages/AccountPages.css](../../advocanote-frontend/src/pages/AccountPages.css), [advocanote-frontend/src/pages/ProfileV2.css](../../advocanote-frontend/src/pages/ProfileV2.css), [advocanote-frontend/src/services/profileApi.js](../../advocanote-frontend/src/services/profileApi.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [toForm](../../advocanote-frontend/src/pages/Profile.jsx#L88), [SettingField](../../advocanote-frontend/src/pages/Profile.jsx#L122), [SectionHeading](../../advocanote-frontend/src/pages/Profile.jsx#L168), [NotificationOption](../../advocanote-frontend/src/pages/Profile.jsx#L201), [ProfileTabs](../../advocanote-frontend/src/pages/Profile.jsx#L229), [Profile](../../advocanote-frontend/src/pages/Profile.jsx#L420)
- **Hook call locations:** `useState` [234](../../advocanote-frontend/src/pages/Profile.jsx#L234), [235](../../advocanote-frontend/src/pages/Profile.jsx#L235), [427](../../advocanote-frontend/src/pages/Profile.jsx#L427), [428](../../advocanote-frontend/src/pages/Profile.jsx#L428), [429](../../advocanote-frontend/src/pages/Profile.jsx#L429), [430](../../advocanote-frontend/src/pages/Profile.jsx#L430), [431](../../advocanote-frontend/src/pages/Profile.jsx#L431), [432](../../advocanote-frontend/src/pages/Profile.jsx#L432), [434](../../advocanote-frontend/src/pages/Profile.jsx#L434), [437](../../advocanote-frontend/src/pages/Profile.jsx#L437), [440](../../advocanote-frontend/src/pages/Profile.jsx#L440), [443](../../advocanote-frontend/src/pages/Profile.jsx#L443) (+4 more), `useEffect` [237](../../advocanote-frontend/src/pages/Profile.jsx#L237), [294](../../advocanote-frontend/src/pages/Profile.jsx#L294), [479](../../advocanote-frontend/src/pages/Profile.jsx#L479), [515](../../advocanote-frontend/src/pages/Profile.jsx#L515), [563](../../advocanote-frontend/src/pages/Profile.jsx#L563), `useRef` [230](../../advocanote-frontend/src/pages/Profile.jsx#L230), [231](../../advocanote-frontend/src/pages/Profile.jsx#L231), [232](../../advocanote-frontend/src/pages/Profile.jsx#L232), [424](../../advocanote-frontend/src/pages/Profile.jsx#L424), [425](../../advocanote-frontend/src/pages/Profile.jsx#L425), `useNavigate` [421](../../advocanote-frontend/src/pages/Profile.jsx#L421)
- **Direct API/helper calls:** [1048](../../advocanote-frontend/src/pages/Profile.jsx#L1048)

### ProfileV2.css

[D:/AdvocaNote/advocanote-frontend/src/pages/ProfileV2.css](../../advocanote-frontend/src/pages/ProfileV2.css)

CSS for Profile V2. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/Profile.jsx](../../advocanote-frontend/src/pages/Profile.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### Register.css

[D:/AdvocaNote/advocanote-frontend/src/pages/Register.css](../../advocanote-frontend/src/pages/Register.css)

CSS for Register. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/Register.jsx](../../advocanote-frontend/src/pages/Register.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### Register.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/Register.jsx](../../advocanote-frontend/src/pages/Register.jsx)

React view for Register. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/pages/Register.css](../../advocanote-frontend/src/pages/Register.css), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `react`, `react-router-dom`
- **Declarations and study starting lines:** [CourtLogo](../../advocanote-frontend/src/pages/Register.jsx#L11), [Brand](../../advocanote-frontend/src/pages/Register.jsx#L40), [Icon](../../advocanote-frontend/src/pages/Register.jsx#L167), [Register](../../advocanote-frontend/src/pages/Register.jsx#L220)
- **Hook call locations:** `useState` [221](../../advocanote-frontend/src/pages/Register.jsx#L221), [228](../../advocanote-frontend/src/pages/Register.jsx#L228), [229](../../advocanote-frontend/src/pages/Register.jsx#L229), [230](../../advocanote-frontend/src/pages/Register.jsx#L230), [231](../../advocanote-frontend/src/pages/Register.jsx#L231), [232](../../advocanote-frontend/src/pages/Register.jsx#L232)
- **Direct API/helper calls:** No static match.

### RejoinAccount.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/RejoinAccount.jsx](../../advocanote-frontend/src/pages/RejoinAccount.jsx)

React view for Rejoin Account. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `@react-oauth/google`, `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [postAccountRequest](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L39), [isValidPassword](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L74), [RejoinAccount](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L211)
- **Hook call locations:** `useState` [224](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L224), [227](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L227), [230](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L230), [233](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L233), [239](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L239), [242](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L242), [244](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L244), [247](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L247), [249](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L249), [251](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L251), [253](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L253), [259](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L259) (+2 more), `useNavigate` [212](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L212)
- **Direct API/helper calls:** [40](../../advocanote-frontend/src/pages/RejoinAccount.jsx#L40)

### ResetPassword.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/ResetPassword.jsx](../../advocanote-frontend/src/pages/ResetPassword.jsx)

React view for Reset Password. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/pages/AuthLayout.css](../../advocanote-frontend/src/pages/AuthLayout.css), [advocanote-frontend/src/pages/ForgotPassword.css](../../advocanote-frontend/src/pages/ForgotPassword.css), [advocanote-frontend/src/pages/Login.css](../../advocanote-frontend/src/pages/Login.css), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `react`, `react-router-dom`
- **Declarations and study starting lines:** [ResetPassword](../../advocanote-frontend/src/pages/ResetPassword.jsx#L14)
- **Hook call locations:** `useState` [20](../../advocanote-frontend/src/pages/ResetPassword.jsx#L20), [22](../../advocanote-frontend/src/pages/ResetPassword.jsx#L22), [24](../../advocanote-frontend/src/pages/ResetPassword.jsx#L24), [26](../../advocanote-frontend/src/pages/ResetPassword.jsx#L26), [28](../../advocanote-frontend/src/pages/ResetPassword.jsx#L28), `useNavigate` [15](../../advocanote-frontend/src/pages/ResetPassword.jsx#L15)
- **Direct API/helper calls:** No static match.

### SriLankaCourtFields.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/SriLankaCourtFields.jsx](../../advocanote-frontend/src/pages/SriLankaCourtFields.jsx)

React view for Sri Lanka Court Fields. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/AddDiaryEntry.jsx](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx)
- **External or unresolved imports:** `react`
- **Declarations and study starting lines:** [SelectOrType](../../advocanote-frontend/src/pages/SriLankaCourtFields.jsx#L62), [SriLankaCourtFields](../../advocanote-frontend/src/pages/SriLankaCourtFields.jsx#L135)
- **Hook call locations:** `useState` [72](../../advocanote-frontend/src/pages/SriLankaCourtFields.jsx#L72)
- **Direct API/helper calls:** No static match.

### Subscription.css

[D:/AdvocaNote/advocanote-frontend/src/pages/Subscription.css](../../advocanote-frontend/src/pages/Subscription.css)

CSS for Subscription. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/Subscription.jsx](../../advocanote-frontend/src/pages/Subscription.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### Subscription.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/Subscription.jsx](../../advocanote-frontend/src/pages/Subscription.jsx)

Lawyer billing screen, catalog and Checkout return polling. **If removed:** The lawyer subscription route loses its UI.

- **Local dependencies:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/pages/AccountPages.css](../../advocanote-frontend/src/pages/AccountPages.css), [advocanote-frontend/src/pages/MyLegalDiary.css](../../advocanote-frontend/src/pages/MyLegalDiary.css), [advocanote-frontend/src/pages/Subscription.css](../../advocanote-frontend/src/pages/Subscription.css), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [getAccessToken](../../advocanote-frontend/src/pages/Subscription.jsx#L57), [apiRequest](../../advocanote-frontend/src/pages/Subscription.jsx#L65), [formatMoney](../../advocanote-frontend/src/pages/Subscription.jsx#L111), [formatDate](../../advocanote-frontend/src/pages/Subscription.jsx#L126), [formatStatus](../../advocanote-frontend/src/pages/Subscription.jsx#L149), [getPlanInterval](../../advocanote-frontend/src/pages/Subscription.jsx#L173), [Subscription](../../advocanote-frontend/src/pages/Subscription.jsx#L200)
- **Hook call locations:** `useState` [211](../../advocanote-frontend/src/pages/Subscription.jsx#L211), [213](../../advocanote-frontend/src/pages/Subscription.jsx#L213), [217](../../advocanote-frontend/src/pages/Subscription.jsx#L217), [220](../../advocanote-frontend/src/pages/Subscription.jsx#L220), [223](../../advocanote-frontend/src/pages/Subscription.jsx#L223), [225](../../advocanote-frontend/src/pages/Subscription.jsx#L225), [228](../../advocanote-frontend/src/pages/Subscription.jsx#L228), [231](../../advocanote-frontend/src/pages/Subscription.jsx#L231), [233](../../advocanote-frontend/src/pages/Subscription.jsx#L233), [234](../../advocanote-frontend/src/pages/Subscription.jsx#L234), [237](../../advocanote-frontend/src/pages/Subscription.jsx#L237), `useEffect` [294](../../advocanote-frontend/src/pages/Subscription.jsx#L294), [298](../../advocanote-frontend/src/pages/Subscription.jsx#L298), [384](../../advocanote-frontend/src/pages/Subscription.jsx#L384), `useMemo` [469](../../advocanote-frontend/src/pages/Subscription.jsx#L469), `useCallback` [251](../../advocanote-frontend/src/pages/Subscription.jsx#L251), `useNavigate` [202](../../advocanote-frontend/src/pages/Subscription.jsx#L202), `useLocation` [201](../../advocanote-frontend/src/pages/Subscription.jsx#L201)
- **Direct API/helper calls:** [65](../../advocanote-frontend/src/pages/Subscription.jsx#L65), [68](../../advocanote-frontend/src/pages/Subscription.jsx#L68), [262](../../advocanote-frontend/src/pages/Subscription.jsx#L262), [263](../../advocanote-frontend/src/pages/Subscription.jsx#L263), [264](../../advocanote-frontend/src/pages/Subscription.jsx#L264), [323](../../advocanote-frontend/src/pages/Subscription.jsx#L323), [330](../../advocanote-frontend/src/pages/Subscription.jsx#L330), [423](../../advocanote-frontend/src/pages/Subscription.jsx#L423), [568](../../advocanote-frontend/src/pages/Subscription.jsx#L568), [602](../../advocanote-frontend/src/pages/Subscription.jsx#L602), [641](../../advocanote-frontend/src/pages/Subscription.jsx#L641), [720](../../advocanote-frontend/src/pages/Subscription.jsx#L720), [806](../../advocanote-frontend/src/pages/Subscription.jsx#L806), [845](../../advocanote-frontend/src/pages/Subscription.jsx#L845)

### TasksPremium.css

[D:/AdvocaNote/advocanote-frontend/src/pages/TasksPremium.css](../../advocanote-frontend/src/pages/TasksPremium.css)

CSS for Tasks Premium. **If removed:** Loaded views lose these selectors or responsive rules.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/TasksPremium.jsx](../../advocanote-frontend/src/pages/TasksPremium.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** No static match.

### TasksPremium.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/TasksPremium.jsx](../../advocanote-frontend/src/pages/TasksPremium.jsx)

React view for Tasks Premium. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/pages/MyLegalDiary.css](../../advocanote-frontend/src/pages/MyLegalDiary.css), [advocanote-frontend/src/pages/TasksPremium.css](../../advocanote-frontend/src/pages/TasksPremium.css), [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js), [advocanote-frontend/src/services/diary.js](../../advocanote-frontend/src/services/diary.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `lucide-react`, `react`, `react-router-dom`
- **Declarations and study starting lines:** [pad](../../advocanote-frontend/src/pages/TasksPremium.jsx#L47), [isoDate](../../advocanote-frontend/src/pages/TasksPremium.jsx#L49), [readDate](../../advocanote-frontend/src/pages/TasksPremium.jsx#L53), [formatDate](../../advocanote-frontend/src/pages/TasksPremium.jsx#L60), [normalizeArray](../../advocanote-frontend/src/pages/TasksPremium.jsx#L71), [taskState](../../advocanote-frontend/src/pages/TasksPremium.jsx#L78), [apiRequest](../../advocanote-frontend/src/pages/TasksPremium.jsx#L90), [MiniCalendar](../../advocanote-frontend/src/pages/TasksPremium.jsx#L127), [TasksPremium](../../advocanote-frontend/src/pages/TasksPremium.jsx#L289)
- **Hook call locations:** `useState` [293](../../advocanote-frontend/src/pages/TasksPremium.jsx#L293), [294](../../advocanote-frontend/src/pages/TasksPremium.jsx#L294), [295](../../advocanote-frontend/src/pages/TasksPremium.jsx#L295), [296](../../advocanote-frontend/src/pages/TasksPremium.jsx#L296), [297](../../advocanote-frontend/src/pages/TasksPremium.jsx#L297), [298](../../advocanote-frontend/src/pages/TasksPremium.jsx#L298), [300](../../advocanote-frontend/src/pages/TasksPremium.jsx#L300), [301](../../advocanote-frontend/src/pages/TasksPremium.jsx#L301), [302](../../advocanote-frontend/src/pages/TasksPremium.jsx#L302), [303](../../advocanote-frontend/src/pages/TasksPremium.jsx#L303), [304](../../advocanote-frontend/src/pages/TasksPremium.jsx#L304), [305](../../advocanote-frontend/src/pages/TasksPremium.jsx#L305) (+7 more), `useEffect` [375](../../advocanote-frontend/src/pages/TasksPremium.jsx#L375), `useMemo` [379](../../advocanote-frontend/src/pages/TasksPremium.jsx#L379), [384](../../advocanote-frontend/src/pages/TasksPremium.jsx#L384), [401](../../advocanote-frontend/src/pages/TasksPremium.jsx#L401), [419](../../advocanote-frontend/src/pages/TasksPremium.jsx#L419), [468](../../advocanote-frontend/src/pages/TasksPremium.jsx#L468), `useCallback` [320](../../advocanote-frontend/src/pages/TasksPremium.jsx#L320), `useNavigate` [290](../../advocanote-frontend/src/pages/TasksPremium.jsx#L290)
- **Direct API/helper calls:** [90](../../advocanote-frontend/src/pages/TasksPremium.jsx#L90), [97](../../advocanote-frontend/src/pages/TasksPremium.jsx#L97), [339](../../advocanote-frontend/src/pages/TasksPremium.jsx#L339), [547](../../advocanote-frontend/src/pages/TasksPremium.jsx#L547), [552](../../advocanote-frontend/src/pages/TasksPremium.jsx#L552), [573](../../advocanote-frontend/src/pages/TasksPremium.jsx#L573), [599](../../advocanote-frontend/src/pages/TasksPremium.jsx#L599)

### VerifyEmail.jsx

[D:/AdvocaNote/advocanote-frontend/src/pages/VerifyEmail.jsx](../../advocanote-frontend/src/pages/VerifyEmail.jsx)

React view for Verify Email. **If removed:** Its route or embedded screen loses the associated UI actions.

- **Local dependencies:** [advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js)
- **Static importers:** [advocanote-frontend/src/App.jsx](../../advocanote-frontend/src/App.jsx)
- **External or unresolved imports:** `react`, `react-router-dom`
- **Declarations and study starting lines:** [VerifyEmail](../../advocanote-frontend/src/pages/VerifyEmail.jsx#L7)
- **Hook call locations:** `useState` [13](../../advocanote-frontend/src/pages/VerifyEmail.jsx#L13), [14](../../advocanote-frontend/src/pages/VerifyEmail.jsx#L14), [15](../../advocanote-frontend/src/pages/VerifyEmail.jsx#L15), [16](../../advocanote-frontend/src/pages/VerifyEmail.jsx#L16), `useNavigate` [8](../../advocanote-frontend/src/pages/VerifyEmail.jsx#L8)
- **Direct API/helper calls:** No static match.

### auth.js

[D:/AdvocaNote/advocanote-frontend/src/services/auth.js](../../advocanote-frontend/src/services/auth.js)

Feature helper or service for auth. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/admin/AdminLayout.jsx](../../advocanote-frontend/src/admin/AdminLayout.jsx), [advocanote-frontend/src/admin/AdminRoute.jsx](../../advocanote-frontend/src/admin/AdminRoute.jsx), [advocanote-frontend/src/components/LawyerLayout.jsx](../../advocanote-frontend/src/components/LawyerLayout.jsx), [advocanote-frontend/src/components/ProtectedRoute.jsx](../../advocanote-frontend/src/components/ProtectedRoute.jsx), [advocanote-frontend/src/pages/Calendar.jsx](../../advocanote-frontend/src/pages/Calendar.jsx), [advocanote-frontend/src/pages/DiaryEntryDetails.jsx](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx), [advocanote-frontend/src/pages/Hearings.jsx](../../advocanote-frontend/src/pages/Hearings.jsx), [advocanote-frontend/src/pages/Login.jsx](../../advocanote-frontend/src/pages/Login.jsx), [advocanote-frontend/src/pages/MyCases.jsx](../../advocanote-frontend/src/pages/MyCases.jsx), [advocanote-frontend/src/pages/MyLegalDiary.jsx](../../advocanote-frontend/src/pages/MyLegalDiary.jsx), [advocanote-frontend/src/pages/Register.jsx](../../advocanote-frontend/src/pages/Register.jsx), [advocanote-frontend/src/pages/ResetPassword.jsx](../../advocanote-frontend/src/pages/ResetPassword.jsx), [advocanote-frontend/src/pages/Subscription.jsx](../../advocanote-frontend/src/pages/Subscription.jsx), [advocanote-frontend/src/pages/TasksPremium.jsx](../../advocanote-frontend/src/pages/TasksPremium.jsx), [advocanote-frontend/src/pages/VerifyEmail.jsx](../../advocanote-frontend/src/pages/VerifyEmail.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** [loginUser](../../advocanote-frontend/src/services/auth.js#L5), [getCurrentUser](../../advocanote-frontend/src/services/auth.js#L39), [registerUser](../../advocanote-frontend/src/services/auth.js#L66), [verifyEmail](../../advocanote-frontend/src/services/auth.js#L114), [forgotPassword](../../advocanote-frontend/src/services/auth.js#L148), [resetPassword](../../advocanote-frontend/src/services/auth.js#L182), [googleResetPassword](../../advocanote-frontend/src/services/auth.js#L219), [googleLogin](../../advocanote-frontend/src/services/auth.js#L267), [logoutUser](../../advocanote-frontend/src/services/auth.js#L300)
- **Hook call locations:** No static match.
- **Direct API/helper calls:** [9](../../advocanote-frontend/src/services/auth.js#L9), [48](../../advocanote-frontend/src/services/auth.js#L48), [72](../../advocanote-frontend/src/services/auth.js#L72), [118](../../advocanote-frontend/src/services/auth.js#L118), [152](../../advocanote-frontend/src/services/auth.js#L152), [186](../../advocanote-frontend/src/services/auth.js#L186), [227](../../advocanote-frontend/src/services/auth.js#L227), [271](../../advocanote-frontend/src/services/auth.js#L271), [309](../../advocanote-frontend/src/services/auth.js#L309)

### diary.js

[D:/AdvocaNote/advocanote-frontend/src/services/diary.js](../../advocanote-frontend/src/services/diary.js)

Feature helper or service for diary. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/AddDiaryEntry.jsx](../../advocanote-frontend/src/pages/AddDiaryEntry.jsx), [advocanote-frontend/src/pages/Calendar.jsx](../../advocanote-frontend/src/pages/Calendar.jsx), [advocanote-frontend/src/pages/CaseDetails.jsx](../../advocanote-frontend/src/pages/CaseDetails.jsx), [advocanote-frontend/src/pages/DiaryEntryDetails.jsx](../../advocanote-frontend/src/pages/DiaryEntryDetails.jsx), [advocanote-frontend/src/pages/Hearings.jsx](../../advocanote-frontend/src/pages/Hearings.jsx), [advocanote-frontend/src/pages/MyCases.jsx](../../advocanote-frontend/src/pages/MyCases.jsx), [advocanote-frontend/src/pages/MyLegalDiary.jsx](../../advocanote-frontend/src/pages/MyLegalDiary.jsx), [advocanote-frontend/src/pages/TasksPremium.jsx](../../advocanote-frontend/src/pages/TasksPremium.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** [diaryRequest](../../advocanote-frontend/src/services/diary.js#L4), [getLawyerCases](../../advocanote-frontend/src/services/diary.js#L42), [getDiaryOverview](../../advocanote-frontend/src/services/diary.js#L46), [createDiaryEntry](../../advocanote-frontend/src/services/diary.js#L52), [getHearings](../../advocanote-frontend/src/services/diary.js#L59), [updateDiaryEntry](../../advocanote-frontend/src/services/diary.js#L63), [deleteDiaryEntry](../../advocanote-frontend/src/services/diary.js#L73), [getDiaryEntryDetails](../../advocanote-frontend/src/services/diary.js#L83), [getCaseDiaryHistory](../../advocanote-frontend/src/services/diary.js#L90)
- **Hook call locations:** No static match.
- **Direct API/helper calls:** [16](../../advocanote-frontend/src/services/diary.js#L16)

### onboardingApi.js

[D:/AdvocaNote/advocanote-frontend/src/services/onboardingApi.js](../../advocanote-frontend/src/services/onboardingApi.js)

Feature helper or service for onboarding Api. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/components/FirstLoginOnboarding.jsx](../../advocanote-frontend/src/components/FirstLoginOnboarding.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** [onboardingRequest](../../advocanote-frontend/src/services/onboardingApi.js#L7), [getMyOnboarding](../../advocanote-frontend/src/services/onboardingApi.js#L42), [completeMyOnboarding](../../advocanote-frontend/src/services/onboardingApi.js#L47), [skipMyOnboarding](../../advocanote-frontend/src/services/onboardingApi.js#L55)
- **Hook call locations:** No static match.
- **Direct API/helper calls:** [16](../../advocanote-frontend/src/services/onboardingApi.js#L16)

### otpRecovery.js

[D:/AdvocaNote/advocanote-frontend/src/services/otpRecovery.js](../../advocanote-frontend/src/services/otpRecovery.js)

Feature helper or service for otp Recovery. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/pages/ForgotPassword.jsx](../../advocanote-frontend/src/pages/ForgotPassword.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** [postRecovery](../../advocanote-frontend/src/services/otpRecovery.js#L4), [requestPasswordOtp](../../advocanote-frontend/src/services/otpRecovery.js#L41), [verifyPasswordOtp](../../advocanote-frontend/src/services/otpRecovery.js#L51), [resetPasswordWithOtp](../../advocanote-frontend/src/services/otpRecovery.js#L62)
- **Hook call locations:** No static match.
- **Direct API/helper calls:** [8](../../advocanote-frontend/src/services/otpRecovery.js#L8)

### profileApi.js

[D:/AdvocaNote/advocanote-frontend/src/services/profileApi.js](../../advocanote-frontend/src/services/profileApi.js)

Feature helper or service for profile Api. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** No static match.
- **Static importers:** [advocanote-frontend/src/components/ProfileAvatar.jsx](../../advocanote-frontend/src/components/ProfileAvatar.jsx), [advocanote-frontend/src/pages/Profile.jsx](../../advocanote-frontend/src/pages/Profile.jsx)
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** [profileRequest](../../advocanote-frontend/src/services/profileApi.js#L7), [getMyProfile](../../advocanote-frontend/src/services/profileApi.js#L46), [updateMyProfile](../../advocanote-frontend/src/services/profileApi.js#L51), [getMyProfilePhoto](../../advocanote-frontend/src/services/profileApi.js#L60), [uploadMyProfilePhoto](../../advocanote-frontend/src/services/profileApi.js#L94), [removeMyProfilePhoto](../../advocanote-frontend/src/services/profileApi.js#L132)
- **Hook call locations:** No static match.
- **Direct API/helper calls:** [16](../../advocanote-frontend/src/services/profileApi.js#L16), [69](../../advocanote-frontend/src/services/profileApi.js#L69), [106](../../advocanote-frontend/src/services/profileApi.js#L106)

### voiceAi.js

[D:/AdvocaNote/advocanote-frontend/src/services/voiceAi.js](../../advocanote-frontend/src/services/voiceAi.js)

Feature helper or service for voice Ai. **If removed:** Dependent flows lose reusable transport or business logic.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** No static match.
- **Declarations and study starting lines:** [analyzeVoiceFile](../../advocanote-frontend/src/services/voiceAi.js#L6)
- **Hook call locations:** No static match.
- **Direct API/helper calls:** [25](../../advocanote-frontend/src/services/voiceAi.js#L25)

### vite.config.js

[D:/AdvocaNote/advocanote-frontend/vite.config.js](../../advocanote-frontend/vite.config.js)

React/Tailwind build and local server configuration. **If removed:** The frontend build/dev tooling loses declared plugins and settings.

- **Local dependencies:** No static match.
- **Static importers:** No static match.
- **External or unresolved imports:** `@tailwindcss/vite`, `@vitejs/plugin-react`, `vite`
- **Declarations and study starting lines:** No static match.
- **Hook call locations:** No static match.
- **Direct API/helper calls:** No static match.
