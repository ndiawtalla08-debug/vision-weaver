import { Button } from '@/components/ui/button'
import { useD1Catalog } from '@/lib/d1-catalog'
import { RefreshCw } from 'lucide-react'

export function D1Status() {
  const { error, retry } = useD1Catalog()
  return error ? <div role="alert" className="notice my-5 flex flex-wrap items-center gap-3"><p>{error}</p><Button variant="outline" size="sm" onClick={() => void retry()}><RefreshCw/>Réessayer</Button></div> : null
}