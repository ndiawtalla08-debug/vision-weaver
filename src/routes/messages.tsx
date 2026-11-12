import { createFileRoute } from '@tanstack/react-router'
import { SellerMessages } from '@/components/seller-messages'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/messages')({head: () => pageHead('Messages reçus', 'Consultez les messages privés reçus pour vos annonces TOUT∞SUITE.'),component:SellerMessages})