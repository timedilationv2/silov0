// Worked examples use a fictional Harbor documentation team/API unless named otherwise.
// Guidance is metadata and is never appended to exportable content.
export const templates = [
  {
    id: "blank",
    name: "Blank document",
    title: "Untitled document",
    format: "markdown",
    content: "",
    audience: "Any writer",
    purpose: "Start without example content.",
    guidance:
      "Choose the format first. Add a title and content suited to your audience.",
  },
  {
    id: "sop",
    name: "Standard operating procedure",
    title: "Rotate a Harbor staging API key",
    format: "markdown",
    audience: "Harbor service operators",
    purpose:
      "Rotate a fictional staging credential with verification and recovery.",
    guidance:
      "Replace the fictional service, owner, and commands with reviewed operations for your environment. Keep real secrets out of documents.",
    content: `# Rotate a Harbor staging API key

## Purpose and scope
Replace the staging credential used by the fictional Harbor queue service without interrupting the production queue. The service owner performs this procedure during an approved maintenance window.

## Before you begin
- Confirm that the selected environment is staging.
- Open the Harbor test client and record its current health result.
- Keep the existing credential active until the replacement is verified.

## Procedure
1. Create a new staging key in the Harbor administration console.
2. Store it in the staging secret manager; do not copy it into a ticket or this document.
3. Update the staging worker's secret reference and restart one worker.
4. Submit a synthetic message from the test client and confirm it completes once.
5. Restart the remaining staging workers, then revoke the old key.

## Verify the result
The synthetic message is acknowledged, the worker logs contain no authentication errors, and the old key is rejected by the test client.

## Recover and escalate
Before revocation, restore the old secret reference if verification fails. After revocation, issue another new key rather than reusing a revoked value. Escalate to the Harbor service owner with timestamps and redacted errors.
`,
  },
  {
    id: "api",
    name: "API reference",
    title: "Harbor Queue API: create a message",
    format: "markdown",
    audience: "Client developers",
    purpose: "Reference for a clearly fictional HTTP operation.",
    guidance:
      "Harbor Queue API is fictional and is not implemented by SiloV. Adapt the route, authentication, limits, and examples together after verifying your real API.",
    content: `# Harbor Queue API: create a message

This worked example describes the fictional Harbor Queue API v1. It is not a SiloV endpoint. All identifiers and responses are illustrative.

## Endpoint and authentication
\`POST https://api.harbor.example/v1/messages\`

Send a bearer token in the Authorization header. Obtain credentials through your team's approved secret-management process.

## Request body
| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| queue | string | yes | Destination queue, such as support |
| text | string | yes | Message text, 1–2,000 characters |

## Request example
\`\`\`http
POST /v1/messages HTTP/1.1
Host: api.harbor.example
Authorization: Bearer DEMO_TOKEN_NOT_A_REAL_SECRET
Content-Type: application/json

{"queue":"support","text":"Check the staging delivery."}
\`\`\`

## Response example
HTTP 201 confirms acceptance; it does not guarantee delivery.

\`\`\`json
{"id":"msg-1042","queue":"support","status":"accepted"}
\`\`\`

## Errors and limits
| Status | Meaning | Action |
| --- | --- | --- |
| 400 | Missing queue or invalid text | Correct the body before retrying |
| 401 | Missing or expired token | Obtain a valid token |
| 429 | More than 60 requests per minute | Wait for Retry-After |

The example API does not promise idempotent retries. Check the message status before resending after a network timeout to avoid duplicates.
`,
  },
  {
    id: "troubleshooting",
    name: "Troubleshooting guide",
    title: "Recover a stalled Harbor staging worker",
    format: "markdown",
    audience: "On-call operators",
    purpose: "Diagnose a fictional queue worker without losing messages.",
    guidance:
      "Substitute actual diagnostic commands and escalation ownership. Verify that your system supports a safe restart before adopting this procedure.",
    content: `# Recover a stalled Harbor staging worker

## Symptom
The fictional Harbor staging dashboard reports messages waiting for more than five minutes while the worker's completed-message count stays unchanged.

## Before you begin
Confirm the environment is staging. Record the worker name and the oldest message timestamp. Do not delete queued messages or expose message bodies in incident notes.

## Diagnose the cause
1. Check the dashboard's last-refresh timestamp. Refresh it before treating stale data as an outage.
2. Inspect worker health. If the process has stopped, use the recovery procedure below.
3. Read recent redacted errors. Authentication errors require credential repair; network timeouts require a connectivity check before restarting.
4. Check whether another worker is processing the queue. Avoid starting a duplicate consumer with the same exclusive lease.

## Resolution
After confirming the existing worker has stopped and released its lease, start one staging worker through the approved service manager. Keep the queue intact. If authentication is failing, restore the staging secret reference before starting the worker.

## Verify recovery
Submit one synthetic message. Confirm the waiting count falls, the completed count rises once, and the health indicator remains healthy for five minutes.

## Escalation
If recovery fails, contact the Harbor service owner with the environment, worker name, time range, and redacted error codes. Include no tokens or customer message content.
`,
  },
  {
    id: "user-guide",
    name: "User guide",
    title: "Review a Harbor documentation change",
    format: "markdown",
    audience: "First-time documentation reviewers",
    purpose: "Guide a fictional team through a complete review task.",
    guidance:
      "Adapt visible control names to your real review tool. This is an example process, not a claim about SiloV collaboration or publishing features.",
    content: `# Review a Harbor documentation change

## What you can do
This fictional Harbor team workflow helps a reviewer check a documentation change before its owner publishes it. A review records evidence; it does not publish the change automatically.

## Before you start
Obtain read access to the proposed source change and its rendered preview. Ask the author which reader task changed and which product version the instructions cover.

## Complete your first review
1. Open the proposed page and read its stated audience and purpose.
2. Follow the main procedure in a clean staging environment.
3. Compare each observed result with the result described in the page.
4. Record a comment beside any unclear step. Include the action, expected result, and observed result without credentials.
5. Tell the author whether you verified the task or need another revision.

## Check presentation
Open internal links, inspect tables on a narrow screen, and navigate controls with the keyboard. Confirm headings describe the reader's tasks rather than the implementation team's milestones.

## When you cannot finish
If access is missing, identify the blocked step and request the least access needed. Do not approve a procedure you could not verify. The author can seek another reviewer while your access is resolved.

## Keep the record
Link the reviewed revision and test evidence in the team's change record. The owner remains responsible for deployment and a separate check of the published page.
`,
  },
  {
    id: "release-notes",
    name: "Release notes",
    title: "Harbor Queue 1.4 release notes",
    format: "markdown",
    audience: "Harbor staging users and integrators",
    purpose: "Explain a fictional release and required reader actions.",
    guidance:
      "Replace this fictional release with verified product changes. Confirm version numbers, compatibility statements, dates, and known issues against release evidence.",
    content: `# Harbor Queue 1.4 release notes

## Release details
Version 1.4 was released to the fictional Harbor staging environment on 2026-10-20. These notes are a writing example; no Harbor service is provided by SiloV.

## Summary
Operators can now filter the staging message list by delivery state. Existing message-submission requests keep their v1 request and response shapes.

## Added
The staging dashboard includes an Accepted filter. Select it to show messages waiting for a worker acknowledgment. Clear the filter to return to the complete list.

## Changed
The queue health panel now displays the time of its last successful refresh. Check this timestamp before diagnosing a worker from dashboard counts.

## Fixed
A display defect that repeated the last row after clearing a search is corrected. This affected the dashboard only; it did not enqueue duplicate messages.

## Compatibility and migration
No client request changes are required for this fictional release. Refresh an open staging dashboard to load the revised controls. Existing credentials remain valid.

## Known issue
A paused browser tab can show stale counts until it is focused and refreshed. Confirm current worker health before taking recovery action.

## Verification and support
The example release checklist covers filtering, cleared searches, and timestamp display. Report a staging issue to the Harbor service owner with the dashboard version and redacted reproduction steps.
`,
  },
  {
    id: "dita-concept",
    name: "DITA concept",
    title: "How a staging queue protects delivery",
    format: "dita",
    audience: "New Harbor operators",
    purpose: "Explain a queue concept using a DITA 1.3 concept topic.",
    guidance:
      "Use concept/conbody for explanatory material. Keep procedures in task topics. The editor checks its documented DITA 1.3 subset, not the complete OASIS grammar.",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<concept id="staging-queue">
  <title>How a staging queue protects delivery</title>
  <shortdesc>A staging queue separates message acceptance from worker processing.</shortdesc>
  <conbody>
    <p>In the fictional Harbor service, accepting a message places it in a queue. A worker later processes that message and acknowledges completion. Acceptance alone does not confirm delivery.</p>
    <section>
      <title>Why acknowledgments matter</title>
      <p>If a worker stops before acknowledging a message, the queue retains work for recovery. Operators check both queue depth and acknowledgments before declaring the service healthy.</p>
      <note>Use synthetic staging messages when learning this process. Do not include customer content in diagnostic notes.</note>
    </section>
  </conbody>
</concept>
`,
  },
  {
    id: "dita-task",
    name: "DITA task",
    title: "Verify a staging queue worker",
    format: "dita",
    audience: "Harbor service operators",
    purpose: "Provide a sequential procedure using DITA 1.3 task structure.",
    guidance:
      "Keep one cmd in each step, before optional info. Add prerequisites before steps and result afterward. Replace the fictional dashboard instructions with verified operations.",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<task id="verify-staging-worker">
  <title>Verify a staging queue worker</title>
  <shortdesc>Use one synthetic message to confirm that a fictional Harbor worker can finish queued work.</shortdesc>
  <taskbody>
    <prereq><p>Open the staging dashboard with operator access. Confirm that no production queue is selected.</p></prereq>
    <context><p>Run this check after a staging worker restart. Record the current completion count before sending a message.</p></context>
    <steps>
      <step><cmd>Submit one synthetic message to the staging queue.</cmd><info><p>Use a recognizable test label without personal data.</p></info></step>
      <step><cmd>Wait for the worker to acknowledge the message.</cmd><info><p>Compare the completion count with the value you recorded.</p></info></step>
    </steps>
    <result><p>The completion count increases once and the queue returns to its previous depth. Otherwise, collect redacted errors and contact the service owner.</p></result>
  </taskbody>
</task>
`,
  },
  {
    id: "dita-reference",
    name: "DITA reference",
    title: "Harbor staging queue states",
    format: "dita",
    audience: "Operators interpreting the dashboard",
    purpose: "Define lookup information using a DITA 1.3 reference topic.",
    guidance:
      "Use refbody/section for reference information. These fictional states are not SiloV API values. Keep terms aligned with the product version you document.",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<reference id="queue-states">
  <title>Harbor staging queue states</title>
  <shortdesc>Use these fictional dashboard states to interpret the progress of one staging message.</shortdesc>
  <refbody>
    <section>
      <title>Accepted</title>
      <p>The queue has stored the message and is waiting for a worker. Acceptance does not prove delivery. Check the oldest waiting timestamp if this state persists.</p>
    </section>
    <section>
      <title>Processing</title>
      <p>A worker holds the message lease. Avoid starting another exclusive worker until you have checked the existing lease and process health.</p>
    </section>
    <section>
      <title>Acknowledged</title>
      <p>The worker has recorded successful completion. A synthetic test should increase the completion count exactly once.</p>
    </section>
  </refbody>
</reference>
`,
  },
  {
    id: "xml-manifest",
    name: "Documentation release manifest",
    title: "Harbor documentation release manifest",
    format: "xml",
    audience: "Documentation release maintainers",
    purpose:
      "Inventory release artifacts using the bundled release-manifest.xsd 1.0 schema.",
    guidance:
      "The schema requires owner, releaseDate, then 1–32 artifacts, each with title, path, and draft/approved status. This fictional inventory neither verifies files nor publishes them.",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!-- Fictional Harbor documentation inventory; paths are illustrative. -->
<releaseManifest id="harbor-docs-1-4" version="1.4">
  <owner>Harbor documentation team</owner>
  <releaseDate>2026-10-20</releaseDate>
  <artifact path="guides/review.html" status="approved">
    <title>Review a Harbor documentation change</title>
  </artifact>
  <artifact path="operations/verify-worker.html" status="draft">
    <title>Verify a staging queue worker</title>
  </artifact>
  <artifact path="releases/1.4.html" status="approved">
    <title>Harbor Queue 1.4 release notes</title>
  </artifact>
</releaseManifest>
`,
  },
];
