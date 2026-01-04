'use client'

import { Menu } from 'lucide-react'
import { Sidebar } from './sidebar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export function MobileSidebar() {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
                <SheetHeader className="sr-only">
                    <SheetTitle>Sidebar Menu</SheetTitle>
                </SheetHeader>
                <Sidebar className="w-full border-none" />
            </SheetContent>
        </Sheet>
    )
}
