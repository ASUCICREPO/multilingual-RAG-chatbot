# Embedding the chat widget on another website

This guide explains how the **floating chat UI** in this repository works, what it depends on, and how you can reuse it on **your own site** (React, plain HTML, or an iframe). It is written for developers integrating with an already-deployed backend from this project.

---

## What you are embedding

The drop-in experience is implemented as the React component **`ChatBot`** (`frontend/app/components/ChatBot.tsx`). Visually it provides:

- A **fixed** launcher button (bottom-right, circular, red accent).
- When open: a **card-style panel** with header, language selector (English / Spanish), connection status, markdown-rendered replies, optional **source document** links, sample prompts, and a message input.

Behaviorally it is **not** a standalone script tag: it talks to **your deployed API** and expects a valid **Amazon Cognito ID token** the same way the reference app does.

---

## Dependencies (must be satisfied on any host)

| Layer | Role |
|--------|------|
| **HTTP API** | Base URL of API Gateway (e.g. `https://xxxx.execute-api.us-east-1.amazonaws.com`). Used for `POST /chat`, `GET /document`, `GET /health`. |
| **Cognito User Pool + App client** | Same pool and app client as the deployed stack. The browser obtains an **ID token** (JWT) and sends `Authorization: Bearer <JWT>` to the API. |
| **End-user identity** | A user who can sign in (username/password in the reference flow) so the widget can obtain a token (`Authorization: Bearer` plus JWT). |

The reference implementation wires this through:

- **`frontend/app/lib/config.ts`** — reads `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_REGION`.
- **`frontend/app/lib/auth.ts`** — `AuthService`: Cognito **`USER_PASSWORD_AUTH`** (not Hosted UI redirect). When the ID token is stale, `getToken()` calls **`InitiateAuth` again** with **username and password** from `sessionStorage` (it does **not** use the Cognito refresh-token grant). Tokens and credentials are stored in **`sessionStorage`** (`jwt_token`, `token_expiry`, `username`, `password`).
- **`frontend/app/lib/chatApi.ts`** — `ChatAPI`: authenticated `fetch` to `/chat` and `/document`.

The chat UI **does not** embed AWS credentials. It only uses **public** Cognito client settings plus tokens after login. The API expects the **Cognito ID token** in the `Authorization` header (see `chatApi.ts`).

---

## CORS and cross-origin behavior

- **API Gateway** in this project is configured with **broad CORS** (`allowOrigins: ['*']`) so browsers can call the API from another origin when sending the `Authorization` header.
- **Cognito** `InitiateAuth` from the browser is subject to **Cognito and browser CORS rules**. If calls from your site’s origin fail in the network tab with CORS errors, use one of: **iframe embedding** (same origin as the hosted app), a **backend token exchange** you control, or **Cognito Hosted UI** with redirects appropriate for your domain.

Always test sign-in and chat from the **exact origin** you will use in production.

---

## Integration option A — React or Next.js on your domain (recommended for a native widget)

Use this when your site is already React-based and you want the widget to live **in the same page** as your content.

### 1. Copy or import the code

Minimum set from this repo:

| Path | Purpose |
|------|---------|
| `frontend/app/components/ChatBot.tsx` | Widget UI and behavior |
| `frontend/app/lib/chatApi.ts` | API + document helpers |
| `frontend/app/lib/auth.ts` | Cognito auth; must still produce **Cognito ID tokens** for this pool/client (or replace with equivalent that does) |
| `frontend/app/lib/config.ts` | Env-based configuration |

If you only copy `ChatBot.tsx`, you must still provide **equivalent** `ChatAPI` / auth / config or refactor imports.

> **Note:** `ChatBot.tsx` also imports `getConfig` from `config.ts` (line 7) but does not call it directly — it is only used indirectly through `ChatAPI` and `AuthService`. The import can be removed if you refactor.

### 2. Install npm dependencies

The widget uses:

- `react`, `react-dom`
- `react-markdown`, `remark-gfm`
- Tailwind-style classes: the reference uses **Tailwind CSS** utility classes. Your app should include **Tailwind** (or map classes to your design system).

Example:

```bash
npm install react-markdown remark-gfm
```

Configure Tailwind per your framework (Next.js, Vite, etc.) and ensure **`@tailwindcss/typography`** if you keep the `prose` classes used for bot messages (`package.json` in this repo lists it).

### 3. Expose environment variables

At build time, set the same public variables the reference app uses:

| Variable | Example meaning |
|----------|-----------------|
| `NEXT_PUBLIC_API_BASE_URL` | API Gateway base URL, **no trailing slash** |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | e.g. `us-east-1_XXXXXXXXX` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | App client ID |
| `NEXT_PUBLIC_COGNITO_REGION` | e.g. `us-east-1` |

**Framework-specific adjustments when not using Next.js:**

| Framework | What to change |
|-----------|----------------|
| **Vite** | `process.env.NEXT_PUBLIC_*` does **not exist** in Vite. Rewrite `config.ts` to use `import.meta.env.VITE_*`. |
| **Create React App** | Rename to `REACT_APP_*` prefixes; `process.env` works as-is. |
| **Any non-Next.js React** | Remove `'use client'` from the top of `ChatBot.tsx` (line 1) — it is a Next.js App Router directive and will cause linter warnings or errors in other toolchains. |
| **Login page** | `frontend/app/login/page.tsx` imports `useRouter` from `next/navigation`, which is **Next.js only**. Replace with your framework's router (e.g. `react-router-dom`) or build your own login form. |

### 4. Authenticate users before showing the widget

In the reference app, the home page only renders `<ChatBot />` after `AuthService.isAuthenticated()` (`frontend/app/page.tsx`). You should apply the same rule on your site:

- Either reuse the included **login page** pattern (`frontend/app/login/page.tsx`) and route users through it, or
- Implement your own login that ends with a stored **ID token** compatible with `AuthService`, or
- Replace `AuthService` only if you still obtain a **Cognito ID token** for the **same user pool and app client** wired to this stack. The HTTP API’s JWT authorizer is fixed to issuer `https://cognito-idp.<region>.amazonaws.com/<userPoolId>` and audience **app client ID** (`bedrock-chatbot-backend-stack.ts`). Other identity providers (Auth0, etc.) are **not** accepted unless you change the backend authorizer or add Cognito federation.

If the user is not logged in, `getToken()` **throws** before the HTTP request. After a successful request, a **401** from the API triggers one retry with a new token (`chatApi.ts`).

**Porting note:** `AuthService.logout()` in `auth.ts` sets `window.location.href = '/login'`. If your site has no `/login` route, override or fork this behavior when embedding.

### 5. Render the widget once per page (or layout)

```tsx
import ChatBot from './components/ChatBot';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatBot />
    </>
  );
}
```

The component uses **`position: fixed`** on the launcher and panel; the outer shell does **not** set a large `z-index` (only inner elements use `relative z-10`). If your site’s chrome covers the widget, add a **`z-index`** (and optionally `isolation`) on a wrapper you own. Also watch `overflow: hidden` and **parent `transform`**, which can affect fixed positioning in some browsers.

### 6. Customize branding (optional)

Strings and colors live inside `ChatBot.tsx` (e.g. “NASWA Assistant”, colors `#c94a3c`, `#1e5a8e`). Edit those classes and copy for your brand. Sample questions are the `sampleQuestions` object at the top of the file.

### 7. Chat history is not persisted

Messages live in **React state only**. If the component unmounts (page navigation, refresh), the conversation is lost — only the Cognito session survives via `sessionStorage`. If your site is a multi-page app or remounts the widget on route changes, users will see a fresh chat each time. To persist history, you would need to add your own storage layer (e.g. `sessionStorage`, `localStorage`, or a backend).

---

## Integration option B — iframe (fastest path, limited styling)

Use this when your main site is **not** React or you want to avoid copying code: load the **already hosted** Amplify app inside an iframe. This repository’s home page includes **Header, Hero, ContentCards, and ChatBot** (`frontend/app/page.tsx`); there is **no** separate “chat-only” route unless you add one. For a smaller iframe footprint, you could add a minimal route or accept the full page in the frame.

### Steps

1. Deploy this project’s frontend as usual. The deploy script prints a URL of the form **`https://main.<defaultDomain>`** (for example `https://main.d1a2b3c4.amplifyapp.com`), where `defaultDomain` comes from Amplify (`main` is the branch name).
2. On your website, add:

```html
<iframe
  src="https://main.d1a2b3c4.amplifyapp.com/"
  title="Assistant"
  style="position: fixed; bottom: 0; right: 0; width: 420px; height: 640px; border: none; z-index: 9999;"
  allow="clipboard-read; clipboard-write"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
></iframe>
```

`sandbox="... allow-popups"` is **required** — the "View" button on source documents calls `window.open()` to open PDFs and files in a new tab. Without it, document links silently fail.

3. Users sign in **inside the iframe**. In the reference app, tokens are kept in **`sessionStorage`**, which is scoped to the **iframe origin** (the Amplify URL), not your top-level domain—so the parent page cannot read the chat session.

### Known limitation: Safari and third-party storage

Safari (and increasingly Chrome with its privacy changes) **blocks `sessionStorage` in cross-origin iframes** by default. Because `AuthService` stores tokens in `sessionStorage`, the login flow will break in these browsers when your host page is on a different domain from the Amplify URL.

**Workarounds:**

- Open the chat app in a **new tab** instead of an iframe (simplest, most reliable).
- Host both your site and the chat app on the **same top-level domain** (e.g. `chat.yourdomain.com` and `www.yourdomain.com`) so the iframe is same-site.
- Use the **Storage Access API** (`document.requestStorageAccess()`) inside the iframe — requires user interaction and is not supported everywhere.

### Trade-offs

| Pros | Cons |
|------|------|
| No React build on your side | Harder to match your site’s header/footer exactly |
| Reuses full login + chat stack | Mobile layout may need iframe size tweaks |
| Avoids Cognito CORS from your domain | SEO and accessibility for the iframe need care |
| | **Safari blocks cross-origin iframe storage** — login may not work (see above) |

You can also link to the chat app in a **new tab** instead of an iframe if you prefer no embedding.

---

## Integration option C — Non-React site (vanilla JS or other frameworks)

There is **no** official single `<script>` bundle in this repo. To support WordPress, static HTML, etc., you can:

1. **Use option B (iframe)** — simplest.

2. **Build a thin client** that mirrors `chatApi.ts`:
   - `POST {API_BASE}/chat` with JSON body `{ message, language, sessionId }` and header `Authorization: Bearer <ID token>`.
   - `GET {API_BASE}/document?path=...` for document links; the backend returns JSON with a pre-signed `url` (see `ChatAPI.viewDocument`).
   - Obtain the ID token via a **small backend** you host that performs Cognito authentication server-side (not included in this repo), **or** embed Cognito Hosted UI / a login page on a subdomain you control.

3. **Compile the React widget** into a **custom bundle** (e.g. Vite library mode or micro-frontend) that exports a mount function — this is custom work on top of the same source files.

---

## API contract (for custom clients)

Details are in **[API Documentation](./apiDoc.md)**. Short summary:

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/health` | None |
| `POST` | `/chat` | `Authorization: Bearer` + Cognito ID token |
| `GET` | `/document?path=` + URL-encoded S3 URI | Same |

Request/response JSON shapes match `ChatRequest` / `ChatResponse` in `frontend/app/lib/chatApi.ts`.

---

## Security and production notes

- **Tokens**: Treat ID tokens as secrets in the browser; prefer HTTPS only. The reference stores tokens in **sessionStorage** (cleared when the tab closes).
- **Plain-text password in `sessionStorage`**: `AuthService` stores the user's **password** in `sessionStorage` (`auth.ts` lines 180-181) so it can re-authenticate when the token expires (it does not use refresh tokens). This means the raw password is readable by any JavaScript on the same origin. If this is unacceptable for your security posture, refactor `AuthService` to use Cognito **refresh tokens** or the **Hosted UI** flow instead.
- **App client**: The Cognito app client is configured **without a secret** (public client), which is normal for SPAs. This app uses **username/password** auth via `USER_PASSWORD_AUTH`, not an OAuth redirect to Cognito Hosted UI—still use **HTTPS** in production.
- **CORS**: Locking down `allowOrigins` to your real domains is recommended for production APIs; if you change the CDK stack, update allowed origins and test the widget from your site.
- **CSP**: If your site sends a `Content-Security-Policy` header, ensure:
  - `connect-src` allows your **API Gateway domain** and the **Cognito endpoint** (`https://cognito-idp.us-east-1.amazonaws.com`).
  - `frame-src` allows the **Amplify domain** (if using the iframe path).
- **Guardrails**: Backend content policies still apply regardless of where the UI is hosted.

---

## Checklist before going live on a new site

- [ ] `NEXT_PUBLIC_API_BASE_URL` (or equivalent) points to the correct API stage.
- [ ] Cognito pool and client IDs match the API authorizer configuration.
- [ ] User can complete login and `AuthService.getToken()` (or your equivalent) returns a token before opening the chat.
- [ ] `GET /health` succeeds from the user’s browser (optional but useful for the connection indicator).
- [ ] Test `POST /chat` from your origin with a real message.
- [ ] If using source links, test `GET /document` for a PDF and a non-PDF file — confirm the new tab opens (not blocked as a popup).
- [ ] If not using Next.js: removed `'use client'` from `ChatBot.tsx` and adapted `config.ts` for your bundler (see framework table above).
- [ ] If using the **iframe** path: test on **Safari** — confirm login and `sessionStorage` work inside the iframe.
- [ ] If your site sets a **CSP** header: verify API and Cognito domains are allowed in `connect-src`.

---

## Related docs

- **[User Guide](./userGuide.md)** — End-user behavior of the chat UI.
- **[API Documentation](./apiDoc.md)** — Full API reference.
- **[Architecture Deep Dive](./architectureDeepDive.md)** — Backend and auth flow.
