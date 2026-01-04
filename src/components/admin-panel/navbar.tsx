import { UserNav } from './user-nav'
import { MobileSidebar } from './mobile-sidebar'

export function Navbar() {
    return (
        <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-[60px] items-center px-4 md:px-8">
                <MobileSidebar />
                <div className="flex flex-1 items-center justify-end space-x-4">
                    <nav className="flex items-center space-x-2">
                        {/* Add search or notifications here if needed */}
                        <UserNav />
                    </nav>
                </div>
            </div>
        </header>
    )
}
