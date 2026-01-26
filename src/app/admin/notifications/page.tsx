'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send, CheckCircle2 } from 'lucide-react'

interface Vendor {
  id: string
  business_name: string
  owner_name: string
  email: string
}

export default function NotificationsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [notificationType, setNotificationType] = useState<'booking_update' | 'system_update' | 'quotation' | 'general'>('general')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingVendors, setFetchingVendors] = useState(true)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await fetch('/api/admin/vendors')
        const data = await res.json()
        if (data && !data.error) {
          setVendors(data)
        }
      } catch (error) {
        console.error('Error fetching vendors:', error)
      } finally {
        setFetchingVendors(false)
      }
    }
    fetchVendors()
  }, [])

  const handleVendorToggle = (vendorId: string) => {
    setSelectedVendors(prev =>
      prev.includes(vendorId)
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    )
  }

  const handleSelectAll = () => {
    if (selectedVendors.length === vendors.length) {
      setSelectedVendors([])
    } else {
      setSelectedVendors(vendors.map(v => v.id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim() || !message.trim()) {
      alert('Please fill in both title and message')
      return
    }

    if (selectedVendors.length === 0) {
      alert('Please select at least one vendor')
      return
    }

    setLoading(true)
    setSuccess(false)

    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendor_ids: selectedVendors,
          type: notificationType,
          title: title.trim(),
          message: message.trim(),
        }),
      })

      const result = await response.json()

      if (result.error) {
        alert(`Error: ${result.error}`)
      } else {
        setSuccess(true)
        setTitle('')
        setMessage('')
        setSelectedVendors([])
        setNotificationType('general')
        
        // Reset success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (error: any) {
      alert(`Error sending notification: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (fetchingVendors) {
    return (
      <DefaultLayout>
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="animate-spin text-primary w-8 h-8" />
        </div>
      </DefaultLayout>
    )
  }

  return (
    <DefaultLayout>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h2 className="text-title-md2 font-bold text-black dark:text-white">
            Send Push Notifications
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Send notifications to vendors via Supabase real-time
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Notification Details</CardTitle>
            <CardDescription>
              Fill in the notification details and select the vendors to notify
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="type" className="block text-sm font-medium mb-2">
                  Notification Type
                </label>
                <select
                  id="type"
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value as any)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="general">General</option>
                  <option value="booking_update">Booking Update</option>
                  <option value="system_update">System Update</option>
                  <option value="quotation">Quotation</option>
                </select>
              </div>

              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-2">
                  Title <span className="text-destructive">*</span>
                </label>
                <Input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter notification title"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter notification message"
                  required
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium">
                    Select Vendors <span className="text-destructive">*</span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedVendors.length === vendors.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="border rounded-md p-4 max-h-64 overflow-y-auto">
                  {vendors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No vendors found</p>
                  ) : (
                    <div className="space-y-2">
                      {vendors.map((vendor) => (
                        <label
                          key={vendor.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedVendors.includes(vendor.id)}
                            onChange={() => handleVendorToggle(vendor.id)}
                            className="rounded border-gray-300"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium">{vendor.business_name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({vendor.owner_name} - {vendor.email})
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {selectedVendors.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedVendors.length} vendor{selectedVendors.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              {success && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm">Notification sent successfully!</span>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="submit"
                  disabled={loading || selectedVendors.length === 0 || !title.trim() || !message.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Notification
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DefaultLayout>
  )
}
