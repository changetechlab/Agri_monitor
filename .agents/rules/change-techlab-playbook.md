# CHANGE TechLab Operating Rules & Playbook

This project follows the **CHANGE TechLab Playbook** operating system for Rural Intelligence, GIS, MRV, and climate-smart agriculture technology.

## Core Principle
**Problem → Research → Prototype → Pilot → Validate → Productize → Scale**

## Golden Rule
**READ FIRST. CHANGE SECOND.**
Never rebuild an existing project merely because a cleaner architecture is possible.

## 1. Engineering Rules
- Inspect the repository before editing.
- Reuse existing components and dependencies where practical.
- Avoid unnecessary frameworks and packages.
- Prefer small, testable changes.
- Preserve existing functionality unless the task explicitly changes it.
- Never silently replace real data with simulated data.

## 2. Data Integrity Rules
Clearly distinguish data states:
- **REAL**
- **SIMULATED**
- **DEMO**
- **ESTIMATED**

*Never present simulated observations as real field or satellite observations.*

## 3. GIS & Remote Sensing Guidelines
- Preserve coordinate reference systems.
- Validate geometries.
- Record imagery date and source where relevant.
- Handle cloud/no-data conditions explicitly.
- Vegetation indices indicate signals/stress; they do not alone prove crop failure.
- Recommend field verification where interpretation is uncertain.

## 4. AI & Data Chain
Use the structured chain:
**Authoritative data → Processing → Rules/Analytics → AI interpretation → Human decision**

AI must never invent:
- Statistics or satellite observations
- Farmer records or financial figures
- Scientific findings or project results

## 5. Security & Credentials
- Never hard-code API keys, passwords, or service-account JSON credentials.
- Never commit secrets or production `.env` files.
- Keep sensitive credentials server-side (`api/` endpoints).
- Do not expose service-account credentials in frontend code.

## 6. Development & Completion Workflow
1. Task intake & Repository Audit
2. Impact Map & Implementation Plan
3. Smallest safe code modifications
4. Verification & diff review
5. Standard Completion Report format:
   - Completed
   - Files changed
   - Tests performed
   - Known limitations
   - Recommended next step
