'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import {
    Users,
    Calendar,
    Briefcase,
    FileText,
    TrendingUp
} from 'lucide-react'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card'
import { Overview } from './components/overview'
import { RecentBookings } from './components/recent-bookings'
import { format, eachDayOfInterval, subDays } from 'date-fns'

export default function DashboardPage() {
    const [stats, setStats] = useState([
        { label: 'Total Vendors', value: '...', icon: Users, color: 'text-blue-600', description: 'Total registered partners' },
        { label: 'Active Bookings', value: '...', icon: Calendar, color: 'text-emerald-600', description: 'Confirmed upcoming events' },
        { label: 'Total Services', value: '...', icon: Briefcase, color: 'text-indigo-600', description: 'Available service offerings' },
        { label: 'New Quotations', value: '...', icon: FileText, color: 'text-amber-600', description: 'Pending price requests' },
    ])
    const [recentBookings, setRecentBookings] = useState<any[]>([])
    const [chartData, setChartData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true)
            try {
                // Fetch Stats from API
                const res = await fetch('/api/admin/stats')
                const data = await res.json()

                setStats([
                    { label: 'Total Vendors', value: String(data.vendors || 0), icon: Users, color: 'text-blue-600', description: 'Total registered partners' },
                    { label: 'Active Bookings', value: String(data.bookings || 0), icon: Calendar, color: 'text-emerald-600', description: 'Confirmed upcoming events' },
                    { label: 'Total Services', value: String(data.services || 0), icon: Briefcase, color: 'text-indigo-600', description: 'Available service offerings' },
                    { label: 'New Quotations', value: String(data.quotations || 0), icon: FileText, color: 'text-amber-600', description: 'Pending price requests' },
                ])

                // Fetch Recent Bookings from API
                const bookingsRes = await fetch('/api/admin/bookings')
                const bookingsData = await bookingsRes.json()
                if (bookingsData) setRecentBookings(bookingsData.slice(0, 5))

                // Process Chart Data (Last 7 days) remains client-side for now or we could move it to API
                const last7Days = eachDayOfInterval({
                    start: subDays(new Date(), 6),
                    end: new Date()
                })

                // Reuse fetched bookings for trend to avoid extra calls
                const processedTrend = last7Days.map(date => {
                    const dateStr = format(date, 'yyyy-MM-dd')
                    const count = bookingsData?.filter((b: any) => b.booking_date === dateStr).length || 0
                    return {
                        name: format(date, 'EEE'),
                        total: count
                    }
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
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-muted-foreground">Manage your event ecosystem and track performance.</p>
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
                                Booking trends for the past week.
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
                                        Latest bookings and event requests.
                                    </CardDescription>
                                </div>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <RecentBookings bookings={recentBookings} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DefaultLayout>
    )
}
