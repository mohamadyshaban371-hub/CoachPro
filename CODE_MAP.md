# 🗺️ CODE_MAP.md — CoachPro / Lotfy EMS System Architecture

> **Stack:** React 18 + Vite + Express (tsx) + Firebase (Auth + Firestore + Storage) + Gemini 1.5 Flash
> **Locale:** Arabic-first (RTL) PWA, English JSON keys / Arabic UI strings.
> **Constraint:** ONLY Gemini + Firebase. Zero OpenAI / Supabase dependencies. Verified.

---

## 1️⃣ Data Flow (End-to-End)

```
┌──────────────┐    1) Auth (Email or Google)
│   Login.tsx  │───────────────────────────────────────┐
└──────────────┘                                       ▼
                                              ┌─────────────────┐
                                              │ Firebase Auth   │
                                              │  + Firestore    │
                                              │  users/{uid}    │
                                              └────────┬────────┘
                                                       │
                                                       │ 2) onSnapshot UserProfile
                                                       ▼
                                              ┌─────────────────┐
                ┌─────────────────────────────│   App.tsx       │
                │                             │  (route gate)   │
                │                             └────────┬────────┘
                │                                      │
       not onboardingComplete                  isActivated &&
                ▼                              !questionnaireComplete
       ┌────────────────┐                              ▼
       │ Onboarding.tsx │                   ┌──────────────────┐
       │ Profile→InBody │                   │ SurveyManager    │
       │ →Health→Goals  │                   │ Nutrition→Workout│
       └────────┬───────┘                   │ →Rehab→EMS       │
                │                           └────────┬─────────┘
                │                                    │
                │                                    ▼
                │                           ┌──────────────────┐
                └───────────────────────────│ ClientDashboard  │
                                            │ (8 tabs)         │
                                            └────────┬─────────┘
                                                     │
                              ┌──────────────────────┼──────────────────────┐
                              ▼                      ▼                      ▼
                      Adaptive Tests          Daily Tasks /         Plans / EMS / Chat
                      (scientificEngine)      Mood / Mic            (aiMasterEngine)
                              │                      │                      │
                              └──────────────────────┴──────────────────────┘
                                                     │
                                          writes to Firestore
                                                     │
                                                     ▼
                                          ┌────────────────────┐
                                          │  AdminDashboard    │
                                          │  (coach review)    │
                                          │  publishes plan ──┐│
                                          └────────────────────┘
```

---

## 2️⃣ File Responsibilities

### `src/App.tsx`
Routing + auth listener + 3-stage gate (`onboardingComplete` → `isActivated` → `questionnaireComplete`). Loads `Onboarding`, `ClientDashboard`, or `AdminDashboard` based on `profile.role`.

### `src/components/Login.tsx`
Email/password + Google sign-in. Creates initial Firestore user doc with default role.

### `src/components/Onboarding.tsx`
4-step wizard:
1. Basic profile (name, height, weight, age, phone, avatar)
2. **InBody photo** upload + Gemini Vision OCR → fills body composition
3. Goals & training style
4. Injury map + medical history → sets `onboardingComplete = true`. User then waits for admin activation.

### `src/components/SurveyManager.tsx`
Sequential survey runner (Nutrition → Workout → EMS → Rehab) gated by membership flags. Sets `questionnaireComplete = true` on finish. Has back button + responsive header.

### `src/components/ClientDashboard.tsx` (3000+ lines — central hub)
8 tabs: `today`, `weekly`, `analysis`, `chat`, `assessment`, `falcon`, `feed`, `profile`.
- **Today**: meals/exercises checklist, mood, smart mic, EMS protocol card.
- **Weekly**: 7-day plan view (per-day nutrition + workout).
- **Assessment**: adaptive tests panel (system-selected, safe-by-design).
- **Falcon**: Falcon-Eye AI insights summary.
- **Feed**: ChampionsFeed social board.
- **Profile**: progress photos, measurements, InBody history.

### `src/components/AdminDashboard.tsx`
Coach console: client list, brain summary (Gemini), plan generation/review/publish, voice-note inbox aggregation, activity feed.

### `src/components/ChampionsFeed.tsx`
Social feed: post types `motivation` / `achievement` / `announcement`. Likes + comments. Awards XP via `awardCoins(uid, 'FEED_POST')`. Image uploads through `/api/upload` proxy.

### `src/components/Chat.tsx` + `src/components/SmartMicInbox.tsx`
- **Chat**: client-facing voice + text chat with 3 mic modes (text / note / ai).
- **SmartMicInbox**: coach-side aggregated voice notes with Gemini summary + suggested replies.

### `src/components/FridgeScanner.tsx`
Image upload → `aiMasterEngine.analyzeMealImage` (Gemini Vision) → ingredient list + Arabic recipe suggestions.

### `src/components/MeasurementUpdate.tsx`
Mandatory check-in modal (every 14 days). Front/Side/InBody photo upload + Gemini OCR → appends to `measurementHistory`.

### `src/components/BadgesPanel.tsx` + `src/components/PointsBadge.tsx`
Badge grid + XP rank pill. Reads from `src/lib/badges.ts` + `src/lib/gamification.ts`.

### `src/components/Profile.tsx`
Self-service profile edit: avatar, contact info, measurements update trigger, photo gallery.

### `src/lib/aiBlocks.ts`
5 deterministic hard-rail blocks injected into every Gemini prompt: `FITNESS_ASSESSMENT`, `NUTRITION`, `CARB_CYCLING`, `TRAINING`, `EMS`. Prevents AI from inventing unsafe values.

### `src/lib/scientificEngine.ts`
- `CATEGORIZED_TESTS` (24 tests, 5 categories, each with safety profile).
- `selectAdaptiveTests(ctx)` — risk-aware test picker.
- `computeRiskLevel(ctx)` — 3-tier user risk classifier (low/medium/high).
- `formatAdaptiveSelectionForPrompt` — Block injection helper.
- `scoreCategorizedTest` — /100 grading.

### `src/lib/emsProtocol.ts`
- `EMS_HZ_BANDS` (recovery / endurance / strength).
- `EMS_MAX_RPE = 9` (RPE 10 banned).
- `validateEMSSession()` — runtime safety check.
- `toClientIntensity()` — strips Hz/µs and returns `light` / `moderate` / `high` + Arabic cue.
- `EMS_PRE_SESSION_CHECKLIST` — 6-item safety list shown before every session.

### `src/lib/badges.ts` + `src/lib/gamification.ts`
- 12 badges (streak, workout warrior, inbody hero, etc.).
- `awardCoins(uid, eventType)` — Firestore-backed XP write.
- Rank tiers: Rookie → Bronze → Silver → Gold → Platinum → Diamond → Legend.

### `src/lib/activityLog.ts`
`logClientActivity(uid, action, meta)` — appends to `users/{uid}/activity` (capped at 200).

### `src/lib/firebaseUtils.ts`
Firebase Web SDK init + helper wrappers. Exposes `auth`, `db`, `storage`.

### `src/lib/macroCalculator.ts`
Mifflin-St Jeor BMR + macro targets by goal/level (used by AI prompts and admin macro card).

### `src/services/aiMasterEngine.ts` (1444 lines — Gemini orchestrator)
- `generateTrainingPlan` — 7-day plan with hard rails (membership-gated).
- `swapExercise` — single-exercise replacement with safety filter.
- `analyzeMealImage` — Gemini Vision multimodal.
- `getQuickReply` — chat AI reply.
- `generateBudgetSubstitutes` — 3 cheap alternatives per meal/ingredient.
- `buildAdaptiveContext` — extracts adaptive test ctx from profile.
- 4 system prompts (nutrition, gym workout, EMS workout, rehab) — all injected with `aiBlocks` headers + adaptive context.

### `server.ts` (Express, port 5000)
- Vite middleware (dev) / static (prod).
- `POST /api/upload` — Firebase Admin Storage proxy.
- `POST /api/transcribe` — audio → text via Gemini.
- mTLS-aware proxy headers for Replit preview.

---

## 3️⃣ Firestore Collections

| Path | Purpose | Written by |
|---|---|---|
| `users/{uid}` | Master profile (auth, onboarding, plans, dailyProgress, measurementHistory, assessmentHistory, packages) | Onboarding, Dashboard, Admin |
| `users/{uid}/adaptiveAssessments/{latest\|<archive-id>}` | Latest + history of adaptive test results | ClientDashboard (`handleSaveAdaptive`) |
| `users/{uid}/voiceNotes/{id}` | Smart-mic recordings (audioBase64 + transcript) | Chat |
| `users/{uid}/activity/{id}` | Client activity log (200-cap rolling) | `logClientActivity` |
| `users/{uid}/notifications/{id}` | In-app bell notifications | Admin / system events |
| `feed/posts/{id}` | ChampionsFeed posts | ChampionsFeed |
| `feed/posts/{id}/comments/{id}` | Comments | ChampionsFeed |
| `feed/posts/{id}/likes/{uid}` | Like marker per user | ChampionsFeed |
| `coachReplies/{id}` | Coach replies to voice notes | SmartMicInbox |

### Key UserProfile sub-objects
- `onboardingData` — form snapshot
- `plans.weeklyPlan` (published) + `plans.weeklyPlanDraft`
- `dailyProgress[YYYY-MM-DD]` — `{ mealsCompleted[], exercisesCompleted[], moodScore, energyLevel }`
- `measurementHistory[]` — every check-in (photos + InBody + dimensions)
- `assessmentHistory[]` — adaptive test results (mirrored from sub-collection)
- `packages` — `{ workout, nutrition, ems, rehab }` boolean flags
- `coins`, `rank`, `streak` — gamification

---

## 4️⃣ AI Decision Flow

```
Client triggers (e.g. coach clicks Generate Plan)
        │
        ▼
┌───────────────────────────────────────────────┐
│ aiMasterEngine.generateTrainingPlan(client)   │
└────────────────────┬──────────────────────────┘
                     │
        ┌────────────┴────────────┬───────────────┬──────────────┐
        ▼                         ▼               ▼              ▼
  buildAdaptiveContext     macroCalculator   aiBlocks       membership flags
  (scientificEngine)       (BMR + macros)    (5 hard rails) (workout/nut/ems/rehab)
        │                         │               │              │
        └────────────┬────────────┴───────────────┴──────────────┘
                     ▼
              systemPrompt (composed)
                     │
                     ▼
        Gemini 1.5 Flash (responseMimeType: application/json)
                     │
                     ▼
              raw JSON → schema-validated parse
                     │
                     ▼
        normalize → sanitize → strip undefined
                     │
                     ▼
   write to users/{uid}.plans.weeklyPlanDraft (admin reviews) → publishes to .weeklyPlan
```

### Hard Rails (deterministic, NEVER overridden by AI)
1. **Membership gate** — empty arrays for unpurchased packages.
2. **Adaptive tests** — AI receives ONLY pre-selected safe tests; cannot invent new.
3. **EMS** — RPE ≤ 9, ≥ 48h between sessions, max 2/week, 1–100Hz only.
4. **Nutrition** — macros computed by `macroCalculator`, AI fills meals to match.
5. **Injuries** — exclusion list passed verbatim; AI must substitute, never aggravate.
6. **Form cues + breathing** — MANDATORY for every exercise (replaces video illustrations).

---

## 5️⃣ Frontend ↔ Backend Mapping

| Frontend call | Server endpoint | Purpose |
|---|---|---|
| `uploadWithRetry()` (any image) | `POST /api/upload` | Firebase Admin Storage upload (avoids CORS + token issues) |
| `Chat.tsx` mic recording | `POST /api/transcribe` | Audio (base64) → Gemini transcription → text |
| All Firestore reads/writes | direct via Web SDK | onSnapshot subscriptions, no proxy |
| Auth | direct via Firebase Auth Web SDK | Email + Google, mTLS-safe |
| Gemini AI calls | direct from client via `aiMasterEngine` | Uses public `GEMINI_API_KEY` (configurable to move server-side later) |

---

## 6️⃣ EMS Data Boundary (Critical)

| Layer | Sees | Hidden |
|---|---|---|
| **Client UI** (`ClientDashboard`) | Exercise name, duration, intensity label (خفيفة/متوسطة/عالية), simple Arabic cue, 6-item pre-session checklist | ❌ Hz, µs, duty cycle, channel mapping, RPE numbers |
| **AI Prompt** (`aiMasterEngine`) | Full Hz/µs/cycle/RPE values + `aiBlocks.EMS` rules | (none — this is internal) |
| **Admin/Coach UI** (`AdminDashboard`) | Full technical breakdown for safety review | (none — coach needs everything) |
| **Firestore `weeklyPlan`** | `pulseIntensity` (raw string), `pulseProtocol` enum, `bodyPosition` | (raw values stored; `toClientIntensity()` translates on render for client only) |

The `toClientIntensity()` helper in `src/lib/emsProtocol.ts` is the **single render-time gate**. Any new client-facing surface that touches an EMS exercise MUST use it.

---

_Last updated: April 2026 — keep in sync with structural changes._


Manual trigger for Vercel deployment - April 2026.
