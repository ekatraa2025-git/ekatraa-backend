'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import {
    Users,
    Calendar,
    Briefcase,
    FileText,
    TrendingUp,
    Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card'
import { Overview } from './components/overview'
import { RecentOrders } from './components/recent-orders'
import { format, eachDayOfInterval, subDays } from 'date-fns'

export default function DashboardPage() {
    const [stats, setStats] = useState([
        { label: 'Total Vendors', value: '...', icon: Users, color: 'text-blue-600', description: 'Total registered partners' },
        { label: 'Active Orders', value: '...', icon: Calendar, color: 'text-emerald-600', description: 'Confirmed upcoming events' },
        { label: 'Total Services', value: '...', icon: Briefcase, color: 'text-indigo-600', description: 'Available service offerings' },
        { label: 'New Quotations', value: '...', icon: FileText, color: 'text-amber-600', description: 'Pending price requests' },
    ])
    const [recentOrders, setRecentOrders] = useState<any[]>([])
    const [chartData, setChartData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [seeding, setSeeding] = useState(false)

    const handleSeed = async () => {
        setSeeding(true)
        try {
            const res = await fetch('/api/admin/seed', { method: 'POST' })
            const data = await res.json()
            if (data.error) toast.error(data.error)
            else toast.success('Database seeded successfully!')
        } catch {
            toast.error('Failed to seed database')
        } finally {
            setSeeding(false)
        }
    }

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true)
            try {
                // Fetch Stats from API
                const res = await fetch('/api/admin/stats')
                const data = await res.json()

                setStats([
                    { label: 'Total Vendors', value: String(data.vendors || 0), icon: Users, color: 'text-blue-600', description: 'Total registered partners' },
                    { label: 'Active Orders', value: String(data.orders || 0), icon: Calendar, color: 'text-emerald-600', description: 'Confirmed upcoming events' },
                    { label: 'Total Services', value: String(data.services || 0), icon: Briefcase, color: 'text-indigo-600', description: 'Available service offerings' },
                    { label: 'New Quotations', value: String(data.quotations || 0), icon: FileText, color: 'text-amber-600', description: 'Pending price requests' },
                ])

                const ordersRes = await fetch('/api/admin/orders')
                const ordersData = await ordersRes.json()
                if (ordersData) setRecentOrders(ordersData.slice(0, 5))

                const last7Days = eachDayOfInterval({
                    start: subDays(new Date(), 6),
                    end: new Date()
                })
                const processedTrend = last7Days.map(date => {
                    const dateStr = format(date, 'yyyy-MM-dd')
                    const count = ordersData?.filter((o: any) => o.event_date && o.event_date.startsWith(dateStr)).length || 0
                    return { name: format(date, 'EEE'), total: count }
                })
                setChartData(processedTrend)

            } catch (error) {
                console.error('Error fetching dashboard data:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchDashboardData()
    }, [])

    return (
        <DefaultLayout>
            <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                        <p className="text-muted-foreground">Manage your event ecosystem and track performance.</p>
                    </div>
                    <Button onClick={handleSeed} disabled={seeding} variant="outline" size="sm">
                        <Database className="mr-2 h-4 w-4" />
                        {seeding ? 'Seeding...' : 'Seed Data'}
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {stats.map((stat, index) => (
                        <Card key={index} className="transition-all hover:shadow-md">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {stat.label}
                                </CardTitle>
                                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stat.value}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {stat.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>Overview</CardTitle>
                            <CardDescription>
                                Order trends for the past week.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <Overview data={chartData} />
                        </CardContent>
                    </Card>
                    <Card className="col-span-3">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Recent Activity</CardTitle>
                                    <CardDescription>
                                        Latest orders and event requests.
                                    </CardDescription>
                                </div>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <RecentOrders orders={recentOrders} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DefaultLayout>
    )
}
