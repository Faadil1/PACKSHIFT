# PACKSHIFT — Living PRD v0.1

## North Star
Make packaging constraints understandable as spatial cause-and-effect rather than hidden file/version complexity.

## Problem
Packaging teams must reconcile market, language, regulatory, sustainability, and brand requirements across many variants. Traditional workflows expose the result as files, comments, versions, and approvals; they rarely make the spatial consequence of each constraint intuitively visible.

## Locked mechanism
**Packaging as a compiled surface.** Requirements enter as constraints. Constraints create surface pressure. Pressure can cause visible collisions. Compile resolves the layout into a valid visual form.

## Primary user / JTBD
Packaging designer or artwork operations lead: “When a market or claim changes, show me what it displaces and how the package can reflow before I manually create another variant.”

## Hero demo
1. Start from one clean master carton.
2. Apply EU market.
3. Add bilingual language requirement.
4. Add data carrier / recycling requirement.
5. Add “24H HYDRATION” claim.
6. Trigger visible collision.
7. Compile and reflow.
8. Switch to Canada and recompile the same object.

## MUST
- One physical package remains the center of the experience.
- Constraints visibly consume/pressure space.
- Collision is legible without reading documentation.
- Compile transforms the package rather than merely changing metadata.
- EU/Canada switch produces an immediately different compiled state.
- Interaction works on desktop and mobile.
- Reduced-motion fallback exists.

## MUST NOT
- Become a dashboard-first SaaS UI.
- Use chatbot interaction.
- Imply actual legal/regulatory validation.
- Present demo rule weights as authoritative regulations.
- Depend on “certificate / receipt / proof badge” mechanics.

## Visual system
Industrial constraint machine + editorial typography + restrained paper materiality. Warm black environment, ivory substrate, red pressure/collision forces, blue data/system forces. Avoid generic neon SaaS glassmorphism.

## Motion grammar
Motion must communicate causality. Constraints push. Collisions compress. Compile redistributes. Stable form calms.

## NFRs
- Fast first paint.
- Keyboard-accessible controls.
- Responsive at 360px+.
- `prefers-reduced-motion` support.
- No external runtime dependencies beyond the frontend bundle.

## Truth boundary
Current prototype uses deterministic rule weights for storytelling. “VALID FORM” means internally resolved demo state, not verified legal compliance.

## Acceptance criteria
- User can reproduce the entire hero sequence manually.
- “RUN 15S DEMO” executes the deterministic sequence.
- Collision appears before compile when pressure exceeds the demo threshold.
- Compile produces a visibly calmer/resolved state.
- Market change reuses the same package object.
- Production build succeeds.
