'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Users,
    Settings,
    Calendar,
    FileText,
    MapPin,
    CreditCard,
    ChevronDown,
    Menu,
    X
} from 'lucide-react'

interface SidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (arg: boolean) => void;
}

const Sidebar = ({ sidebarOpen, setSidebarOpen }: SidebarProps) => {
    const pathname = usePathname()
    const trigger = useRef<any>(null)
    const sidebar = useRef<any>(null)

    const [sidebarExpanded, setSidebarExpanded] = useState(true)

    // close on click outside
    useEffect(() => {
        const clickHandler = ({ target }: MouseEvent) => {
            if (!sidebar.current || !trigger.current) return
            if (
                !sidebarOpen ||
                sidebar.current.contains(target) ||
                trigger.current.contains(target)
            )
                return
            setSidebarOpen(false)
        }
        document.addEventListener('click', clickHandler)
        return () => document.removeEventListener('click', clickHandler)
    })

    // close if the esc key is pressed
    useEffect(() => {
        const keyHandler = ({ keyCode }: KeyboardEvent) => {
            if (!sidebarOpen || keyCode !== 27) return
            setSidebarOpen(false)
        }
        document.addEventListener('keydown', keyHandler)
        return () => document.removeEventListener('keydown', keyHandler)
    })

    const menuItems = [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
        { name: 'Vendors', icon: Users, path: '/admin/vendors' },
        { name: 'Bookings', icon: Calendar, path: '/admin/bookings' },
        { name: 'Bookings Allocation', icon: MapPin, path: '/admin/locations' },
        { name: 'Quotations', icon: FileText, path: '/admin/quotations' },
        { name: 'Payments', icon: CreditCard, path: '/admin/payments' },
        { name: 'Settings', icon: Settings, path: '/admin/settings' },
    ]

    return (
        <aside
            ref={sidebar}
            className={`absolute left-0 top-0 z-50 flex h-screen w-72.5 flex-col overflow-y-hidden bg-[#1c2434] duration-300 ease-linear dark:bg-boxdark lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
        >
            {/* SIDEBAR HEADER */}
            <div className="flex items-center justify-between gap-2 px-6 py-5.5 lg:py-6.5">
                <Link href="/admin/dashboard" className="flex items-center space-x-3">
                    <Image
                        width={40}
                        height={40}
                        src={"/logo.png"}
                        alt="Logo"
                        priority
                        className="object-contain"
                    />
                    <span className="text-white text-2xl font-bold tracking-tight">EKATRAA</span>
                </Link>

                <button
                    ref={trigger}
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-controls="sidebar"
                    aria-expanded={sidebarOpen}
                    className="block lg:hidden text-white"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
            {/* SIDEBAR HEADER */}

            <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
                {/* Sidebar Menu */}
                <nav className="mt-5 px-4 py-4 lg:mt-9 lg:px-6">
                    {/* Menu Group */}
                    <div>
                        <h3 className="mb-4 ml-4 text-sm font-semibold text-slate-500 uppercase">
                            MENU
                        </h3>

                        <ul className="mb-6 flex flex-col gap-1.5">
                            {menuItems.map((item) => (
                                <li key={item.path}>
                                    <Link
                                        href={item.path}
                                        className={`group relative flex items-center gap-2.5 rounded-sm px-4 py-2 font-medium text-slate-400 duration-300 ease-in-out hover:bg-[#333a48] hover:text-white ${pathname.startsWith(item.path) && 'bg-[#333a48] text-white'
                                            }`}
                                    >
                                        <item.icon className="w-5 h-5" />
                                        {item.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </nav>
                {/* Sidebar Menu */}
            </div>
        </aside>
    )
}

export default Sidebar
