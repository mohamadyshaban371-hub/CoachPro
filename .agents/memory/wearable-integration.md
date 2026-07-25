---
name: Wearable Integration Architecture
description: Design decisions for the universal smartwatch / health integration rebuild.
---

## Normalized data model
- Single record per day: `users/{uid}/dailyLogs/{YYYY-MM-DD}/watch` (type: `WatchDaySnapshot` in types.ts)
- `WatchDaySnapshot` is backward-compatible: old fields (steps, sleepHours, hr, hrUpdatedAt, deviceName, syncedAt) kept; new fields are additive
- `WearableProviderKey` union type added to types.ts; `provider` field on each snapshot indicates source

## Provider tiers (current release)
- **Tier 1 (always):** `manual` (typed values), `export_import` (JSON paste from any app)
- **Tier 2 (Chrome desktop/Android only):** `web_bluetooth` (live HR via GATT 0x180D)
- **Tier 3 (native shell required):** `health_connect`, `healthkit` — android/ and ios/ NOT initialized; UI shows clear notice
- **Tier 4 (planned, not implemented):** fitbit, garmin, oura, whoop, polar, suunto, zepp, coros, withings, samsung, huawei — accessible via export_import only; OAuth server-side tokens not yet stored

## Age resolution — fixed inconsistency
- `SmartwatchPanel` previously used hardcoded fallback 30; AI engine used 25
- Both now call `resolveClientAge(profile)` from `aiMasterEngine.ts` (exported)
- **Why:** Max HR (Tanaka formula) must be identical across UI and AI — drift causes wrong strain classification

## Daily date keys
- `todayKey()` in smartwatch.ts now uses local timezone (not UTC ISO), matching the rest of the app
- **Why:** UTC ISO dates can create off-by-one on midnight boundaries for non-UTC users

## scientificEngine: HR strain fatigue signal
- `DailyProgressLog` gains optional `hrStrain` field
- `ProgressionWindow` gains `highHrStrainDays`
- `analyzeProgressionWindow` flags `fatigued` if `highHrStrainDays >= 2` in 14-day window
- `buildDailyProgressLogs` in aiMasterEngine merges `dailyLogs[date].watch.hrStrain` into the log

## emsProtocol: recovery-adjusted EMS
- New `computeEMSRecoveryAdjustment(EMSRecoveryInput)` function
- Decision matrix: recoveryScore < 30 or sleep < 5h + HRV < 30 → block; < 50 or < 6h or high strain → recovery band RPE ≤ 5; < 70 or < 7h → endurance RPE ≤ 7; otherwise → strength RPE ≤ 9
- **Why:** EMS on extreme fatigue risks muscle damage; deterministic gate before Gemini prompt

## aiMasterEngine: wearable readiness
- `resolveReadiness` return type extended with: `watchHrv`, `watchRecoveryScore`, `watchHrStrain`, `watchSpo2`
- These are passed to downstream consumers (AI prompt builders) but callers must guard for undefined
- `resolveClientAge` is now exported (was private function)

## SmartwatchPanel: 3-tab UI
- Tab "اليوم": recovery ring (SVG gauge 0-100), adaptive advice banner, HR strain banner, primary stats grid (steps/sleep/HR), expandable extras (HRV/SpO2/calories/sleep stages), Bluetooth bar
- Tab "الاتجاهات": 7-day sparklines for recovery/sleep/steps/restingHR/HRV
- Tab "الاتصال": available providers, full provider catalog with export buttons
- Manual entry modal: 11 fields (steps, sleep, hr, hrResting, hrv, spo2, calories, sleepDeep, sleepRem, bodyWeight, recoveryScore)
- Export import modal: JSON paste parser → field preview → save; detects provider from JSON shape
- Recovery score: derived locally from sleep+HRV+resting HR when provider doesn't supply one

## HR persistence throttle fix
- Old: only ±3 BPM change gate (no time floor)
- New: ±3 BPM AND min 60 seconds between writes
- **Why:** volatile HR can hammer Firestore during active sessions

## Compliance score
- Expanded from 9pts/day (steps+sleep+HR) to 12pts/day (steps+sleep+recovery signal)
- Recovery score is now factored in when available; HR reading is fallback proxy
