
const products = [
  { id: 1, name: "Acid-Wash Sleeveless Tank", price: 3490, sizes: ["S", "M", "L", "XL"], colors: ["Black", "Grey", "Olive"] },
  { id: 2, name: "Wide-Leg Track Pants", price: 4290, sizes: ["S", "M", "L", "XL"], colors: ["Black", "Grey", "White"] },
  { id: 3, name: "Acid-Wash Crop Top", price: 3290, sizes: ["S", "M", "L"], colors: ["Black", "Grey", "Olive"] },
  { id: 4, name: "Essential Oversized Tee", price: 2990, sizes: ["S", "M", "L", "XL"], colors: ["Black", "White", "Grey"] }
];

function json(data, status = 200) {
  return Response.json(data, { status });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      try {
        await env.DB.prepare("SELECT 1").first();
        return json({ success: true, database: "connected" });
      } catch {
        return json({ success: false, error: "Database unavailable" }, 500);
      }
    }

    if (url.pathname === "/api/orders" && request.method === "POST") {
      try {
        const body = await request.json();
        const customer = body.customer;
        const items = body.items;

        if (!customer || !Array.isArray(items) || items.length === 0 || items.length > 30) {
          return json({ success: false, error: "Please check your order details." }, 400);
        }

        const first = String(customer.first || "").trim();
        const last = String(customer.last || "").trim();
        const phone = String(customer.phone || "").trim();
        const email = String(customer.email || "").trim();
        const address = String(customer.address || "").trim();
        const city = String(customer.city || "").trim();
        const district = String(customer.district || "").trim();

        if (!first || !last || !phone || !address || !city) {
          return json({ success: false, error: "Please complete all required delivery fields." }, 400);
        }

        if (first.length > 80 || last.length > 80 || phone.length > 25 ||
            email.length > 254 || address.length > 500 ||
            city.length > 100 || district.length > 100) {
          return json({ success: false, error: "Some details are too long." }, 400);
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return json({ success: false, error: "Please enter a valid email address." }, 400);
        }

        if (body.payment !== "COD") {
          return json({
            success: false,
            error: "Online payment is not available yet. Please choose Cash on Delivery."
          }, 400);
        }

        let subtotal = 0;
        const checkedItems = [];

        for (const item of items) {
          const product = products.find(p => p.id === Number(item.id));
          const quantity = Number(item.quantity);
          const size = String(item.size || "");
          const color = String(item.color || "");

          if (
            !product ||
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            quantity > 20 ||
            !product.sizes.includes(size) ||
            !product.colors.includes(color)
          ) {
            return json({ success: false, error: "An item in your bag is invalid. Please review your order." }, 400);
          }

          subtotal += product.price * quantity;
          checkedItems.push({ ...product, size, color, quantity });
        }

        if (subtotal > 1000000) {
          return json({ success: false, error: "Order total exceeds the allowed limit." }, 400);
        }

        const orderId = crypto.randomUUID();
        const deliveryFee = 0;
        const total = subtotal + deliveryFee;
        const customerName = `${first} ${last}`.trim();

        const statements = [
          env.DB.prepare(`
            INSERT INTO orders
              (id, customer_name, phone, email, address, city, district,
               payment_method, subtotal, delivery_fee, total, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'COD', ?, ?, ?, 'pending')
          `).bind(
            orderId, customerName, phone, email || null,
            address, city, district, subtotal, deliveryFee, total
          )
        ];

        for (const item of checkedItems) {
          statements.push(
            env.DB.prepare(`
              INSERT INTO order_items
                (order_id, product_id, product_name, size, color, quantity, unit_price)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
              orderId, String(item.id), item.name,
              item.size, item.color, item.quantity, item.price
            )
          );
        }

        await env.DB.batch(statements);

        return json({
          success: true,
          orderId,
          total,
          message: "Your order has been received."
        }, 201);
      } catch (error) {
        return json({
          success: false,
          error: "We could not save your order. Please try again."
        }, 500);
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ success: false, error: "API route not found" }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
