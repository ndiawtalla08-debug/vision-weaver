import { createServerFn } from '@tanstack/react-start'
import { catalogSchema, d1BaseUrl, type D1Catalog } from './d1-schema'

// Fixed public endpoints only: no arbitrary URL, credential forwarding, or writes.
export const readD1Catalog = createServerFn({ method: 'GET' }).handler(async (): Promise<{ catalog: D1Catalog; error: string | null }> => {
  try {
    const responses = await Promise.all(['stores', 'products', 'categories', 'announcements'].map(async path => {
      const response = await fetch(`${d1BaseUrl}/${path}`, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } })
      if (!response.ok) {
        const detail = await response.text()
        console.error(`D1 ${path} [${response.status}]: ${detail}`)
        throw new Error(`Lecture D1 refusée (${response.status}).`)
      }
      return response.json()
    }))
    return { catalog: catalogSchema.parse(Object.assign({}, ...responses)), error: null }
  } catch (error) {
    console.error('D1 catalog unavailable', error)
    return { catalog: { stores: [], products: [], categories: [], announcements: [] }, error: 'Les boutiques et annonces sont momentanément indisponibles. Veuillez réessayer.' }
  }
})