'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { LogIn, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })
            const data = await res.json()

            if (data.error) {
                setError(data.error)
                setLoading(false)
            } else {
                router.push('/admin')
                router.refresh()
            }
        } catch (error: any) {
            setError('An unexpected error occurred. Please try again.')
            setLoading(false)
        }
    }

    return (
        <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
            <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
                <div className="absolute inset-0 bg-slate-900">
                    <Image
                        src="/login-bg.png"
                        alt="Background"
                        fill
                        className="object-cover opacity-60"
                        priority
                    />
                </div>
                <div className="relative z-20 flex items-center text-2xl font-bold gap-2">
                    <Image src="/logo.png" alt="Logo" width={40} height={40} className="invert brightness-0" />
                    EKATRAA
                </div>
                <div className="relative z-20 mt-auto">
                    <blockquote className="space-y-2">
                        <p className="text-lg">
                            &ldquo;This platform streamlines event management, bringing vendors and customers together in one seamless ecosystem.&rdquo;
                        </p>
                        <footer className="text-sm">Ekatraa Admin Control</footer>
                    </blockquote>
                </div>
            </div>
            <div className="p-4 lg:p-8 h-full flex items-center">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                    <div className="flex flex-col space-y-2 text-center items-center">
                        <div className="lg:hidden mb-4">
                            <Image src="/logo.png" alt="Logo" width={64} height={64} />
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Admin Login
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Enter your credentials to access the portal
                        </p>
                    </div>

                    <Card>
                        <CardHeader className="space-y-1">
                            {error && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive text-sm mb-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <form onSubmit={handleLogin}>
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <label htmlFor="email" className="text-sm font-medium">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="admin@ekatraa.com"
                                                className="pl-9"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <label htmlFor="password" className="text-sm font-medium">Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="password"
                                                type="password"
                                                placeholder="••••••••"
                                                className="pl-9"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Logging in...
                                            </>
                                        ) : (
                                            <>
                                                <LogIn className="mr-2 h-4 w-4" />
                                                Sign In
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                    <p className="px-8 text-center text-sm text-muted-foreground">
                        Authorized Personnel Only
                    </p>
                </div>
            </div>
        </div>
    )
}
