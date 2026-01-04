'use client'

import { cn } from '@/lib/utils'
import { Sidebar } from './sidebar'
import { Navbar } from './navbar'

export default function PanelLayout({
    children
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen">
            <Sidebar className="hidden md:block" />
            <div className="flex flex-1 flex-col transition-all duration-300 ease-in-out">
                <Navbar />
                <main className="flex-1 overflow-y-auto bg-slate-50/50 p-4 md:p-8">
                    <div className="mx-auto max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
