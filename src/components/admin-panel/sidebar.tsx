'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Users,
    Settings,
    Calendar,
    FileText,
    Briefcase,
    MapPin,
    CreditCard,
    ChevronLeft,
    Layers
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SidebarProps {
    className?: string
}

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname()

    const menuItems = [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
        { name: 'Vendors', icon: Users, path: '/admin/vendors' },
        { name: 'Categories', icon: Layers, path: '/admin/categories' },
        { name: 'Services', icon: Briefcase, path: '/admin/services' },
        { name: 'Bookings', icon: Calendar, path: '/admin/bookings' },
        { name: 'Bookings Allocation', icon: MapPin, path: '/admin/locations' },
        { name: 'Quotations', icon: FileText, path: '/admin/quotations' },
        { name: 'Payments', icon: CreditCard, path: '/admin/payments' },
        { name: 'Settings', icon: Settings, path: '/admin/settings' },
    ]

    return (
        <aside className={cn("relative z-20 h-screen w-72 border-r bg-card transition-all duration-300 ease-in-out", className)}>
            <div className="flex h-full flex-col">
                <div className="flex h-[60px] items-center border-b px-6">
                    <Link href="/admin/dashboard" className="flex items-center gap-2 font-bold">
                        <Image
                            src="/logo.png"
                            alt="Logo"
                            width={32}
                            height={32}
                            className="rounded-lg"
                        />
                        <span className="text-xl tracking-tight">EKATRAA</span>
                    </Link>
                </div>
                <ScrollArea className="flex-1 px-3 py-4">
                    <div className="space-y-1">
                        <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Main Menu
                        </h2>
                        {menuItems.map((item) => (
                            <Button
                                key={item.path}
                                asChild
                                variant={pathname.startsWith(item.path) ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-start gap-3 px-4",
                                    pathname.startsWith(item.path) && "bg-secondary font-semibold"
                                )}
                            >
                                <Link href={item.path}>
                                    <item.icon className="h-5 w-5" />
                                    {item.name}
                                </Link>
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
                <div className="mt-auto border-t p-4">
                    <Button variant="ghost" className="w-full justify-start gap-3">
                        <Settings className="h-5 w-5" />
                        Admin Settings
                    </Button>
                </div>
            </div>
        </aside>
    )
}
