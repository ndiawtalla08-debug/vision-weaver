import { createFileRoute } from '@tanstack/react-router'
import { SellerProducts } from '@/components/seller-products'
import { pageHead } from '@/lib/page-head'

export const Route = createFileRoute('/mes-produits')({ head: () => pageHead('Mes produits', 'Gérez les produits, brouillons et publications de votre boutique TOUT∞SUITE ANNONCES au Sénégal.'), component: SellerProducts })