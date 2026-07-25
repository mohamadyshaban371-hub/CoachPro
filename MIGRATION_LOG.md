# Migration Log

## Files created
- src/core/services/auth.service.ts
- src/core/services/users.service.ts
- src/core/services/notifications.service.ts
- src/core/services/storage.service.ts
- src/core/services/index.ts

## What was moved
- Firebase authentication helpers were wrapped in auth service.
- Shared user document and activity-entry patterns were centralized in users service.
- Notification creation and read-marking logic were centralized in notifications service.
- Upload orchestration and proxy-upload logic were centralized in storage service.
- Existing helper modules were adapted to delegate to the new services without changing their public API.

## What was not moved
- aiMasterEngine was not modified.
- AdminDashboard was not modified.
- ClientDashboard was not modified.
- Component-level usage of existing Firebase helpers was not changed yet.

## Next step
- Review the new service boundaries and begin a second pass to gradually update specific components to consume the new services directly while keeping behavior unchanged.
