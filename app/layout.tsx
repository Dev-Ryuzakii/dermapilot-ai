import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'DermaPilot AI | Understand Your Skin. Shop Smarter.', description: 'A thoughtful skincare companion for understanding visible skin characteristics, building routines, and shopping with confidence.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en" data-scroll-behavior="smooth"><body suppressHydrationWarning>{children}</body></html>; }
