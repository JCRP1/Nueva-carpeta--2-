ces# TODO: Fix Everything (Arreglar Todo) - GreenSense Project

## Current Status
- [x] Analyzed project structure, ARCHITECTURE.md, key files
- [x] Identified main issues: Incomplete API routes for people/users, frontend/backend mismatch
- [x] Plan approved, proceeding step-by-step

## Detailed Plan & Progress

### 1. Complete app/api/people/route.ts (Personas table CRUD) ✓
- [x] Add POST: Create new Persona  
- [x] Add PATCH: Update Persona
- [x] Add DELETE: Delete Persona

### 2. Complete app/api/users/route.ts (Usuarios table CRUD)
- [ ] Add POST: Create Usuario (bcrypt password)
- [ ] Add PATCH: Update Usuario
- [ ] Add DELETE: Delete Usuario

### 3. Fix components/personal-view.tsx
- [ ] Fix CRUD calls to use /api/people (add api.people methods)
- [ ] Fix promote flow: POST to /api/users with proper data
- [ ] Fix promoteRole handling (string name vs ID)

### 4. Add app/api/roles/route.ts
- [ ] GET: List roles from Rols table

### 5. Update lib/api-client.ts
- [ ] Add people-specific methods

### 6. Testing & Cleanup
- [ ] Run `npm run lint`
- [ ] Test endpoints
- [ ] Update TODO as completed

## Next Step
Implement app/api/people/route.ts full CRUD

**Use `npm` for commands (user confirmed)**
