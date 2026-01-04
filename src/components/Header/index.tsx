'use client'

import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Menu, Search, Bell, User, LogOut } from 'lucide-react'

interface HeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (arg: boolean) => void;
}

const Header = ({ sidebarOpen, setSidebarOpen }: HeaderProps) => {
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    return (
        <header className="sticky top-0 z-40 flex w-full bg-white drop-shadow-1 dark:bg-boxdark dark:drop-shadow-none">
            <div className="flex flex-grow items-center justify-between px-4 py-4 shadow-2 md:px-6 2xl:px-11">
                <div className="flex items-center gap-2 sm:gap-4 lg:hidden">
                    {/* Hamburger Toggle */}
                    <button
                        aria-controls="sidebar"
                        onClick={(e) => {
                            e.stopPropagation()
                            setSidebarOpen(!sidebarOpen)
                        }}
                        className="z-50 block rounded-sm border border-stroke bg-white p-1.5 shadow-sm dark:border-strokedark dark:bg-boxdark lg:hidden"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>

                <div className="hidden sm:block">
                    <form action="" method="POST">
                        <div className="relative">
                            <button className="absolute left-0 top-1/2 -translate-y-1/2">
                                <Search className="w-5 h-5 text-slate-400" />
                            </button>

                            <input
                                type="text"
                                placeholder="Type to search..."
                                className="w-full bg-transparent pl-9 pr-4 font-medium focus:outline-none xl:w-125"
                            />
                        </div>
                    </form>
                </div>

                <div className="flex items-center gap-3 2xsm:gap-7">
                    <ul className="flex items-center gap-2 2xsm:gap-4">
                        {/* Notification Menu */}
                        <li>
                            <button className="relative flex h-8.5 w-8.5 items-center justify-center rounded-full border-[0.5px] border-stroke bg-gray hover:text-blue-600 dark:border-strokedark dark:bg-meta-4 dark:text-white">
                                <Bell className="w-5 h-5" />
                                <span className="absolute -top-0.5 right-0 z-1 h-2 w-2 rounded-full bg-red-500"></span>
                            </button>
                        </li>
                    </ul>

                    {/* User Area */}
                    <div className="relative flex items-center gap-4">
                        <span className="hidden text-right lg:block">
                            <span className="block text-sm font-medium text-black dark:text-white">
                                Admin User
                            </span>
                            <span className="block text-xs font-medium text-slate-500">
                                admin@ekatraa.com
                            </span>
                        </span>

                        <button
                            onClick={handleLogout}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    )
}

export default Header
