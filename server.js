const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// MySQL Connection 
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', 
  password: '', 
  database: 'sales_management'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

// API Routes

app.get('/api/products', (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) res.status(500).send(err);
    else res.json(results);
  });
});

app.post('/api/products', (req, res) => {
  const { name, description, price, stock, image } = req.body;
  db.query('INSERT INTO products (name, description, price, stock, image) VALUES (?, ?, ?, ?, ?)',
    [name, description, price, stock, image], (err, result) => {
    if (err) res.status(500).send(err);
    else res.json({ id: result.insertId });
  });
});

app.put('/api/products/:id', (req, res) => {
  const { name, description, price, stock, image } = req.body;
  db.query('UPDATE products SET name = ?, description = ?, price = ?, stock = ?, image = ? WHERE id = ?',
    [name, description, price, stock, image, req.params.id], (err) => {
    if (err) res.status(500).send(err);
    else res.sendStatus(200);
  });
});

app.delete('/api/products/:id', (req, res) => {
  const productId = req.params.id;
  
  // Check if product is used in orders
  db.query('SELECT COUNT(*) as count FROM orders WHERE product_id = ?', [productId], (err, results) => {
    if (err) return res.status(500).send(err);
    if (results[0].count > 0) return res.status(400).send('Cannot delete product referenced in orders');
    
    db.query('DELETE FROM products WHERE id = ?', [productId], (err) => {
      if (err) res.status(500).send(err);
      else res.sendStatus(200);
    });
  });
});

// Orders
app.get('/api/orders', (req, res) => {
  db.query('SELECT * FROM orders', (err, results) => {
    if (err) res.status(500).send(err);
    else res.json(results);
  });
});

app.post('/api/orders', (req, res) => {
  const { customer_name, product_id, quantity, status } = req.body;
  
  // Check stock first
  db.query('SELECT stock FROM products WHERE id = ?', [product_id], (err, productResults) => {
    if (err) return res.status(500).send(err);
    if (productResults.length === 0) return res.status(404).send('Product not found');
    
    const currentStock = productResults[0].stock;
    if (currentStock < quantity) return res.status(400).send('Insufficient stock');
    
    // Insert order
    db.query('INSERT INTO orders (customer_name, product_id, quantity, status) VALUES (?, ?, ?, ?)',
      [customer_name, product_id, quantity, status], (err, result) => {
      if (err) return res.status(500).send(err);
      
      // Update stock
      db.query('UPDATE products SET stock = stock - ? WHERE id = ?', [quantity, product_id], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ id: result.insertId });
      });
    });
  });
});

app.get('/api/orders/:id', (req, res) => {
  db.query('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, results) => {
    if (err) res.status(500).send(err);
    else res.json(results[0]);
  });
});

app.put('/api/orders/:id', (req, res) => {
  const { customer_name, product_id, quantity, status } = req.body;
  const orderId = req.params.id;
  
  // Get current order
  db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err, orderResults) => {
    if (err) return res.status(500).send(err);
    if (orderResults.length === 0) return res.status(404).send('Order not found');
    
    const currentOrder = orderResults[0];
    const oldQuantity = currentOrder.quantity;
    const oldProductId = currentOrder.product_id;
    
    // Check stock if product changed or quantity increased
    if (oldProductId !== product_id || quantity > oldQuantity) {
      const stockNeeded = (oldProductId === product_id) ? quantity - oldQuantity : quantity;
      db.query('SELECT stock FROM products WHERE id = ?', [product_id], (err, productResults) => {
        if (err) return res.status(500).send(err);
        if (productResults.length === 0) return res.status(404).send('Product not found');
        
        const currentStock = productResults[0].stock;
        if (currentStock < stockNeeded) return res.status(400).send('Insufficient stock');
        
        updateOrder();
      });
    } else {
      updateOrder();
    }
    
    function updateOrder() {
      db.query('UPDATE orders SET customer_name = ?, product_id = ?, quantity = ?, status = ? WHERE id = ?',
        [customer_name, product_id, quantity, status, orderId], (err) => {
        if (err) return res.status(500).send(err);
        
        // Adjust stock
        if (oldProductId === product_id) {
          // Same product, adjust difference
          const stockChange = oldQuantity - quantity;
          db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [stockChange, product_id], (err) => {
            if (err) return res.status(500).send(err);
            res.sendStatus(200);
          });
        } else {
          // Different product, restore old, deduct new
          db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [oldQuantity, oldProductId], (err) => {
            if (err) return res.status(500).send(err);
            db.query('UPDATE products SET stock = stock - ? WHERE id = ?', [quantity, product_id], (err) => {
              if (err) return res.status(500).send(err);
              res.sendStatus(200);
            });
          });
        }
      });
    }
  });
});

app.delete('/api/orders/:id', (req, res) => {
  const orderId = req.params.id;
  
  // Get order details before deleting
  db.query('SELECT * FROM orders WHERE id = ?', [orderId], (err, orderResults) => {
    if (err) return res.status(500).send(err);
    if (orderResults.length === 0) return res.status(404).send('Order not found');
    
    const order = orderResults[0];
    
    // Delete order
    db.query('DELETE FROM orders WHERE id = ?', [orderId], (err) => {
      if (err) return res.status(500).send(err);
      
      // Restore stock
      db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [order.quantity, order.product_id], (err) => {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
      });
    });
  });
});

// Payments
app.get('/api/payments', (req, res) => {
  db.query('SELECT * FROM payments', (err, results) => {
    if (err) res.status(500).send(err);
    else res.json(results);
  });
});

app.post('/api/payments', (req, res) => {
  const { order_id, discount, payment_method } = req.body;
  // Fetch order and product to calculate total
  db.query('SELECT * FROM orders WHERE id = ?', [order_id], (err, orderResults) => {
    if (err) return res.status(500).send(err);
    const order = orderResults[0];
    db.query('SELECT * FROM products WHERE id = ?', [order.product_id], (err, productResults) => {
      if (err) return res.status(500).send(err);
      const product = productResults[0];
      const total = order.quantity * product.price * (1 - discount / 100);
      // Update order status to Completed when payment is made
      db.query('UPDATE orders SET status = ? WHERE id = ?', ['Completed', order_id], (err) => {
        if (err) return res.status(500).send(err);
        db.query('INSERT INTO payments (order_id, discount, payment_method, status) VALUES (?, ?, ?, ?)',
          [order_id, discount || 0, payment_method || 'COD', 'Completed'], (err, result) => {
          if (err) res.status(500).send(err);
          else res.json({ id: result.insertId });
        });
      });
    });
  });
});

// Add more routes as needed

app.listen(3000, () => {
  console.log('Server running on port 3000');
});