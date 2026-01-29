import { apiFetch } from './http'

// GET /api/getAllEvent
export async function getAllEvent() {
  return await apiFetch<unknown>('/getAllEvent', { method: 'GET' })
}

