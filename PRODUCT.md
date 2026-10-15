# Afterlight

Small teams launch from scattered tickets, screenshots and a final “looks good.” Afterlight gives every release one launch room: owners, a deadline, evidence attached to every required check, a server-enforced go/no-go decision and an immutable shipment snapshot.

The primary workflow is create a release from a template → assign owners → collect evidence → resolve blockers → review readiness → ship → retain a decision record. No AI claims, synthetic monitoring metrics or invented customer activity.

This first version is a single workspace for a small trusted team. Local mode binds to loopback. Hosted mode requires a workspace password and a session-signing secret. Every release mutation has optimistic concurrency protection and an audit event. Shipped releases are locked. Evidence URLs accept only HTTP/HTTPS. A release cannot ship until every required check is complete and supported by evidence, and every blocker is complete.

The UI includes an explicitly labeled interactive example workspace; real releases start without fabricated evidence. The product is built for a real launch handoff, with a downloadable release record.

ATLAS will run its tests, HTTP checks, browser journeys, staging revision verification, and audit export against this repository. Any model-auth or cloud access failure must remain visible in the handoff.
