/**
 * Cart/order lifecycle test (run after migrations and with server up).
 * Usage: API_BASE=http://localhost:3000 node tests/cart-order-lifecycle.mjs
 * Or: npm run test
 */
const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function request(method, path, body = null) {
    const url = path.startsWith('http') ? path : `${BASE}${path}`
    const opts = { method, headers: { 'Content-Type': 'application/json' } }
    if (body && (method === 'POST' || method === 'PATCH')) {
        opts.body = JSON.stringify(body)
    }
    let res
    try {
        res = await fetch(url, opts)
    } catch (err) {
        const code = err.cause?.code ?? err.cause?.errors?.[0]?.code ?? err.code
        if (code === 'ECONNREFUSED') {
            console.error('Cannot connect to', BASE)
            console.error('Start the backend first: npm run dev')
            process.exit(1)
        }
        throw err
    }
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
}

async function run() {
    console.log('Cart/order lifecycle test. Base URL:', BASE)
    const errors = []

    const { status: cartStatus, data: cart } = await request('POST', '/api/public/cart', {
        session_id: 'test-session-' + Date.now(),
        event_name: 'Test Event',
        event_date: '2025-12-01',
        contact_name: 'Test User',
        contact_mobile: '9999999999',
    })
    if (cartStatus !== 201 || !cart?.id) {
        errors.push(`Create cart failed: ${cartStatus} ${JSON.stringify(cart)}`)
        console.error(errors[errors.length - 1])
        process.exitCode = 1
        return
    }
    console.log('Created cart:', cart.id)

    const { data: services } = await request('GET', '/api/public/services?category_id=venue')
    const serviceId = services?.[0]?.id
    if (!serviceId) {
        console.log('Skip add-item and checkout: no offerable_services (run migrations and backfill)')
        console.log('Gate 2 API routes are in place. Run migrations in Supabase then re-run this test.')
        return
    }

    const { status: itemStatus, data: item } = await request('POST', '/api/public/cart/items', {
        cart_id: cart.id,
        service_id: serviceId,
        quantity: 2,
        unit_price: 100,
    })
    if (itemStatus !== 201) {
        errors.push(`Add cart item failed: ${itemStatus} ${JSON.stringify(item)}`)
    } else {
        console.log('Added cart item:', item.id)
    }

    const testUserId = '00000000-0000-0000-0000-000000000001'
    const { status: orderStatus, data: order } = await request('POST', '/api/public/checkout', {
        cart_id: cart.id,
        user_id: testUserId,
    })
    if (orderStatus !== 201 || !order?.id) {
        errors.push(`Checkout failed: ${orderStatus} ${JSON.stringify(order)}`)
    } else {
        console.log('Created order:', order.id, 'total:', order.total_amount)
    }

    if (order?.id) {
        const { status: getStatus, data: orderDetail } = await request('GET', `/api/public/orders/${order.id}`)
        if (getStatus !== 200) {
            errors.push(`Get order failed: ${getStatus}`)
        } else if (!orderDetail?.items?.length) {
            errors.push('Order has no items')
        } else {
            console.log('Order items:', orderDetail.items.length)
        }
    }

    if (errors.length) {
        console.error('Errors:', errors)
        process.exitCode = 1
    } else {
        console.log('Cart/order lifecycle test passed.')
    }
}

run().catch((e) => {
    console.error(e)
    process.exitCode = 1
})
