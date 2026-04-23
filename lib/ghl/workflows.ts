/**
 * GoHighLevel Workflows API wrapper.
 *
 * GHL's public workflows endpoint lists workflows and lets us enrol a
 * contact into a specific one. Workflow step configuration (delays,
 * branching) is designed inside GHL's UI — we never push workflow DSL.
 */

import { ghlFetch } from "./client"
import { getGhlConfig } from "./config"
import type { GhlWorkflow } from "./types"

interface WorkflowListResponse {
  workflows: GhlWorkflow[]
}

export async function listWorkflows(): Promise<GhlWorkflow[]> {
  const locationId = getGhlConfig().locationId
  const res = await ghlFetch<WorkflowListResponse>("/workflows/", {
    method: "GET",
    query: { locationId },
  })
  return res.workflows ?? []
}

export async function getWorkflow(workflowId: string): Promise<GhlWorkflow> {
  const res = await ghlFetch<{ workflow: GhlWorkflow } | GhlWorkflow>(
    `/workflows/${workflowId}`,
  )
  if ("workflow" in (res as { workflow: GhlWorkflow })) {
    return (res as { workflow: GhlWorkflow }).workflow
  }
  return res as GhlWorkflow
}

/**
 * Enrol a contact into a workflow.
 *
 * GHL's POST path for this is:
 *   /contacts/{contactId}/workflow/{workflowId}
 */
export async function enrollContact(
  contactId: string,
  workflowId: string,
): Promise<{ succeded: boolean }> {
  return ghlFetch<{ succeded: boolean }>(
    `/contacts/${contactId}/workflow/${workflowId}`,
    { method: "POST" },
  )
}

export async function unenrollContact(
  contactId: string,
  workflowId: string,
): Promise<{ succeded: boolean }> {
  return ghlFetch<{ succeded: boolean }>(
    `/contacts/${contactId}/workflow/${workflowId}`,
    { method: "DELETE" },
  )
}
