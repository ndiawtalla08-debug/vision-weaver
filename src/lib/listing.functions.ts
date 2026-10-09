import { createServerFn } from '@tanstack/react-start'

export type ListingInput = { image: string; name: string; category: string; price: string; details: string }
export type Listing = { title: string; description: string; highlights: string[]; specifications: string[]; tags: string[] }

const schema = {
  type: 'object', additionalProperties: false,
  required: ['title', 'description', 'highlights', 'specifications', 'tags'],
  properties: {
    title: { type: 'string' }, description: { type: 'string' },
    highlights: { type: 'array', items: { type: 'string' } },
    specifications: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
  },
}

export const generateListing = createServerFn({ method: 'POST' })
  .inputValidator((input: ListingInput) => {
    if (!input.image?.startsWith('data:image/') || input.image.length > 7_000_000) throw new Error('Photo invalide ou trop lourde (5 Mo maximum).')
    return { ...input, name: String(input.name).slice(0, 120), category: String(input.category).slice(0, 60), price: String(input.price).slice(0, 20), details: String(input.details).slice(0, 1500) }
  })
  .handler(async ({ data }): Promise<{ ok: true; listing: Listing } | { ok: false; error: string }> => {
    const apiKey = process.env['LOVABLE_API_KEY']
    if (!apiKey) return { ok: false, error: 'Service de rédaction non configuré.' }
    const prompt = `Rédige en français une fiche produit pour une boutique en ligne au Sénégal (prix en FCFA). Appuie-toi sur la photo et ces informations du vendeur. N'invente aucune caractéristique invisible ou non fournie.\nNom : ${data.name}\nCatégorie : ${data.category}\nPrix : ${data.price} FCFA\nDétails : ${data.details}\nTitre de 70 caractères maximum, description de 80 à 150 mots, 3 à 5 points forts, caractéristiques courtes, 5 mots-clés.`
    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra', stream: true, store: false,
        reasoning: { effort: 'low', summary: 'auto' }, include: ['reasoning.encrypted_content'],
        text: { format: { type: 'json_schema', name: 'fiche_produit', strict: true, schema } },
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: data.image }] }],
      }),
    })
    if (!res.ok || !res.body) {
      const messages: Record<number, string> = { 402: 'Crédits IA épuisés. Rechargez votre espace de travail.', 429: 'Trop de demandes, réessayez dans un instant.', 403: 'Accès au modèle refusé.' }
      return { ok: false, error: messages[res.status] ?? `Rédaction impossible (erreur ${res.status}).` }
    }
    const reader = res.body.getReader(); const decoder = new TextDecoder()
    let buffer = '', text = '', failure = ''
    for (;;) {
      const { done, value } = await reader.read(); if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim(); if (!raw || raw === '[DONE]') continue
        try {
          const event = JSON.parse(raw)
          if (event.type === 'response.output_text.delta') text += event.delta
          if (event.type === 'response.refusal.delta') failure = 'Le modèle a refusé de rédiger cette fiche.'
          if (event.type === 'response.failed' || event.type === 'error') failure = 'La rédaction a échoué.'
        } catch { /* fragment ignoré */ }
      }
    }
    if (failure) return { ok: false, error: failure }
    try { return { ok: true, listing: JSON.parse(text) as Listing } } catch { return { ok: false, error: 'Réponse du modèle illisible, réessayez.' } }
  })
