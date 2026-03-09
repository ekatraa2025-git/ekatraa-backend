import {
    Avatar,
    AvatarFallback,
} from '@/components/ui/avatar'

interface RecentOrdersProps {
    orders: any[]
}

export function RecentOrders({ orders }: RecentOrdersProps) {
    return (
        <div className="space-y-8">
            {orders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent orders found.</p>
            )}
            {orders.map((order) => (
                <div key={order.id} className="flex items-center">
                    <Avatar className="h-9 w-9">
                        <AvatarFallback>
                            {order.contact_name?.[0]?.toUpperCase() || 'O'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{order.contact_name || order.event_name || 'Order'}</p>
                        <p className="text-sm text-muted-foreground">
                            {order.vendor_name || 'Vendor Unassigned'}
                        </p>
                    </div>
                    <div className="ml-auto font-medium">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                            order.status === 'confirmed' ? 'bg-green-50 text-green-700'
                            : order.status === 'pending' ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-slate-50 text-slate-700'
                        }`}>
                            {order.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    )
}
