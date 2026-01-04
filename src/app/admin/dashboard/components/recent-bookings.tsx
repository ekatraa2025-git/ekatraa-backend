import {
    Avatar,
    AvatarFallback,
} from '@/components/ui/avatar'

interface RecentBookingsProps {
    bookings: any[]
}

export function RecentBookings({ bookings }: RecentBookingsProps) {
    return (
        <div className="space-y-8">
            {bookings.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent bookings found.</p>
            )}
            {bookings.map((booking) => (
                <div key={booking.id} className="flex items-center">
                    <Avatar className="h-9 w-9">
                        <AvatarFallback>
                            {booking.customer_name?.[0]?.toUpperCase() || 'C'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{booking.customer_name}</p>
                        <p className="text-sm text-muted-foreground">
                            {booking.vendors?.business_name || 'Vendor Unassigned'}
                        </p>
                    </div>
                    <div className="ml-auto font-medium">
                        <span className={`text-xs px-2 py-1 rounded-full ${booking.status === 'confirmed' ? 'bg-green-50 text-green-700' :
                                booking.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                                    'bg-slate-50 text-slate-700'
                            }`}>
                            {booking.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    )
}
