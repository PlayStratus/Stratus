import type { Metadata } from "next"

import ClientPage from "./ClientPage"

export const metadata: Metadata = {
  title: "Direct Connect",
}

export default function DirectConnectPage() {
  return <ClientPage />
}
