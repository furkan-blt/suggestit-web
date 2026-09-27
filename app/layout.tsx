import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'SuggestIT — Sıradaki filmini keşfet', description:'Film geçmişinden sana özel öneriler.', icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="tr"><body>{children}</body></html> }
