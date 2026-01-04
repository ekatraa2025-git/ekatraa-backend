'use client'

import PanelLayout from '@/components/admin-panel/panel-layout'

export default function DefaultLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <PanelLayout>{children}</PanelLayout>
}

