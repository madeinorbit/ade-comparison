# Agent finding cross-check: [product]

Checking agent: [name distinct from researcher]
Cross-check date: [YYYY-MM-DD]
Scoped release, plan, clients and execution modes: [exact scope]

Full-profile pairs already exist regardless of cross-check coverage. This checklist records a second-agent pass on individual sourced findings; it does not approve or create a pair page. Humans approve this checklist, the rubric and the prototype rather than every product claim.

For each claim proposed for agent cross-check:

- [ ] The answer and every atomic answer say only what the cited source establishes.
- [ ] Supported, partial and unsupported statements cite resolved public evidence.
- [ ] Unknowns remain unknown. Missing search results are not negative evidence.
- [ ] Limitations name untested scenarios and scope boundaries.
- [ ] Product surfaces, version, plan, operating system and execution mode are explicit.
- [ ] Evidence URLs, locators, source dates and retrieval dates are usable.
- [ ] The current official roadmap, changelog or releases, docs and public repository issues were searched and recorded. Announcements are cited, dated, scoped and separate from shipped capability answers; unavailable roadmap sources are named as gaps.
- [ ] `nextReviewAt` matches the volatility of the fact.
- [ ] The checking agent is distinct from the research agent and has resolved contradictions.
- [ ] Sourced findings do not receive the cross-checked label until this pass is recorded. A source check alone is not a second-agent pass.
- [ ] Record `review.contentHash: claimReviewHash(profile, claim)` after checking the final claim, scope, dates and every row or atomic citation. Changed content requires another independent review.

After the cross-check, update the claim's internal workflow state and run every validation and site build command in the publication README. Do not edit generated pages.

For a lifecycle sunset notice, also check:

- [ ] The named company or hosted-service scope is distinct from any continuing local open-source use and from capability support.
- [ ] Dates come from the primary source. A relative transition period has not been converted into an invented exact deadline or runtime observation.
- [ ] The notice has current resolved public evidence and no unresolved contradiction. Candidates stay private until this independent review.
- [ ] Record `review.contentHash: lifecycleReviewHash(profile)` only after checking the final lifecycle fields and cited evidence. Source or notice changes require another review.
- [ ] The sanitized export includes the lifecycle evidence even when no capability cites it; expired notices and their exclusive citations disappear together.
