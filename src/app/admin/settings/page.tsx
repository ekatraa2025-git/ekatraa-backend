'use client'

import React from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { User, Bell, Shield, Globe, Save, Lock } from 'lucide-react'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function SettingsPage() {
    return (
        <DefaultLayout>
            <div className="mx-auto max-w-4xl space-y-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Settings</h2>
                    <p className="text-muted-foreground">Manage your account settings and preferences.</p>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-primary" />
                                Admin Profile
                            </CardTitle>
                            <CardDescription>
                                Update your personal information and contact details.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        Full Name
                                    </label>
                                    <Input placeholder="Admin Ekatraa" defaultValue="Admin Ekatraa" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        Email Address
                                    </label>
                                    <Input placeholder="admin@ekatraa.com" defaultValue="admin@ekatraa.com" disabled />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="border-t px-6 py-4">
                            <Button className="ml-auto">
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary" />
                                Security
                            </CardTitle>
                            <CardDescription>
                                Secure your account with a strong password.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                We recommend using a unique password for this account.
                            </p>
                        </CardContent>
                        <CardFooter className="border-t px-6 py-4">
                            <Button variant="outline">
                                <Lock className="mr-2 h-4 w-4" />
                                Change Password
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="h-5 w-5 text-primary" />
                                Notifications
                            </CardTitle>
                            <CardDescription>
                                Configure how you receive alerts and updates.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground italic">Notification preferences are coming soon.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DefaultLayout>
    )
}

