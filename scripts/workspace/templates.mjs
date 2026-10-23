export const templates = [
  { id: 'blank', name: 'Blank document', title: 'Untitled document', content: '' },
  { id: 'sop', name: 'Standard Operating Procedure (SOP)', title: 'Standard Operating Procedure', content: `# Standard Operating Procedure

> Replace bracketed guidance before publishing.

## Purpose
[Describe the repeatable task and the outcome this procedure produces.]

## Scope and ownership
- Applies to: [team, system, or situation]
- Procedure owner: [role responsible for accuracy]
- Review date: [YYYY-MM-DD]

## Prerequisites
- [Required access, tools, and information]
- [Safety checks or approvals required before starting]

## Procedure
1. [Describe the first action with a clear verb.]
2. [Describe the next action and its expected result.]
3. [Explain what to do if the result differs.]

## Verification
[How can the operator confirm the task succeeded?]

## Rollback and escalation
[Describe a safe recovery path and the role to contact.]

## Revision history
| Date | Change | Reviewer |
| --- | --- | --- |
| [YYYY-MM-DD] | Initial draft | [Role] |
` },
  { id: 'api', name: 'API Reference', title: 'API Reference', content: `# API Reference

## Overview
[State the capability, intended client, and API version.]

## Authentication
[Describe the authentication scheme and where credentials belong. Never include real credentials.]

## Endpoint
\`METHOD /resource\`

[Explain what this operation does and whether it changes state.]

## Parameters
| Name | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| [name] | [path/query/body] | [type] | [yes/no] | [Accepted values and limits] |

## Request example
\`\`\`http
GET /resource HTTP/1.1
Host: api.example.invalid
\`\`\`

## Response example
\`\`\`json
{"example": "Replace with a verified response"}
\`\`\`

## Status codes and errors
| Status | Meaning | Client action |
| --- | --- | --- |
| [code] | [condition] | [recovery action] |

## Limits and compatibility
[Document pagination, rate limits, versioning, and constraints.]
` },
  { id: 'troubleshooting', name: 'Troubleshooting Guide', title: 'Troubleshooting Guide', content: `# Troubleshooting Guide

## Symptom
[Describe the visible behavior and exact error text, without sensitive data.]

## Affected environments
[List the versions, platforms, or conditions where this guidance applies.]

## Before you begin
[Record required access and any risk of data loss.]

## Diagnose the cause
1. [Run a safe check.]
2. [Explain how to interpret each possible result.]

## Resolution
1. [Describe the smallest corrective action.]
2. [Provide an alternative if that action is unavailable.]

## Verify recovery
[Give a concrete success check and expected result.]

## Escalation
[Identify the responsible role and safe diagnostic information to collect.]
` },
  { id: 'user-guide', name: 'User Guide', title: 'User Guide', content: `# User Guide

## What you can do
[Explain the product capability in the reader's language.]

## Before you start
[Specify prerequisites, permissions, and supported environments.]

## Complete your first task
1. [Start from a named screen or entry point.]
2. [Describe the action using the visible control label.]
3. [Explain the expected result.]

## Common tasks
### [Task name]
[Provide steps and an outcome for one reader goal.]

## Troubleshooting
[Describe common obstacles and link to focused recovery instructions.]

## Limitations and next steps
[Set expectations about unsupported actions and where to learn more.]
` },
  { id: 'release-notes', name: 'Release Notes', title: 'Release Notes', content: `# Release Notes

## Release details
- Version: [version]
- Release date: [YYYY-MM-DD]
- Audience: [affected users]

## Summary
[Describe what changed and why it matters. Do not invent adoption or performance claims.]

## Added
- [New capability and how to access it]

## Changed
- [Behavior that differs from the previous version]

## Fixed
- [Verified issue, symptom, and corrected behavior]

## Breaking changes and migration
[Explain required reader actions, or explicitly state that none are required after verification.]

## Known issues
[Document remaining limitations and available workarounds.]

## Verification and support
[Link to release evidence and the support or feedback route.]
` },
]
