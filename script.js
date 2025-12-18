// ===========================
// Global Variables
// ===========================
let editingOrderRow = null; // Track row being edited
let oldQuantity = 0; // For stock adjustment on edit
let editingProductId = null; // Track product being edited

// API Base URL
const API_BASE = 'http://localhost:3000/api';

// ===========================
// Data Loading Functions
// ===========================

// Load Products from API
async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE}/products`, { cache: 'no-cache' });
    const products = await response.json();
    const tbody = document.querySelector('#productTable');
    tbody.innerHTML = '';
    products.forEach(product => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>PR-${String(product.id).padStart(3, '0')}</td>
        <td>${product.name}</td>
        <td>${product.description}</td>
        <td>${product.price}</td>
        <td>${product.stock}</td>
        <td><img src="${product.image}" alt="${product.name}" style="width:50px; height:50px;"></td>
        <td>
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    updateProductDropdown();
    updateProductDashboard();
  } catch (error) {
    alert('Error loading products: ' + error.message);
  }
}

// Load Orders from API
async function loadOrders() {
  try {
    const response = await fetch(`${API_BASE}/orders`, { cache: 'no-cache' });
    const orders = await response.json();
    const tbody = document.querySelector('#orderTable tbody');
    tbody.innerHTML = '';
    orders.forEach(order => {
      const row = document.createElement('tr');
      row.setAttribute('data-date', new Date(order.created_at).toISOString().split('T')[0]);
      row.innerHTML = `
        <td data-field="orderID">OR-${String(order.id).padStart(3, '0')}</td>
        <td data-field="customerName">${order.customer_name}</td>
        <td data-field="productID">PR-${String(order.product_id).padStart(3, '0')}</td>
        <td data-field="quantity">${order.quantity}</td>
        <td data-field="status">${order.status}</td>
        <td>
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    updateOrderDropdown();
  } catch (error) {
    alert('Error loading orders: ' + error.message);
  }
}

// Load Payments from API (now shows all orders with payment status)
async function loadPayments() {
  try {
    // Load all data in parallel
    const [ordersResponse, paymentsResponse, productsResponse] = await Promise.all([
      fetch(`${API_BASE}/orders`, { cache: 'no-cache' }),
      fetch(`${API_BASE}/payments`, { cache: 'no-cache' }),
      fetch(`${API_BASE}/products`, { cache: 'no-cache' })
    ]);
    
    const orders = await ordersResponse.json();
    const payments = await paymentsResponse.json();
    const products = await productsResponse.json();
    
    const tbody = document.querySelector('#paymentTable');
    tbody.innerHTML = '';
    
    for (const order of orders) {
      // Find payment for this order (if exists)
      const payment = payments.find(p => p.order_id === order.id);
      
      // Find product details
      const product = products.find(p => p.id === order.product_id);
      
      if (!product) {
        console.error('Product not found for order:', order);
        continue;
      }
      
      // Calculate total (with discount if payment exists)
      const discount = payment ? payment.discount : 0;
      const total = order.quantity * product.price * (1 - discount / 100);
      
      const row = document.createElement('tr');
      row.setAttribute('data-date', new Date(order.created_at).toISOString().split('T')[0]);
      row.setAttribute('data-order-id', `OR-${String(order.id).padStart(3, '0')}`);
      row.innerHTML = `
        <td>${order.customer_name}</td>
        <td>${product.name}</td>
        <td>${order.quantity}</td>
        <td>${total.toFixed(2)}</td>
        <td>${payment ? payment.payment_method : 'Not Paid'}</td>
        <td>${payment ? payment.status : 'Pending'}</td>
      `;
      tbody.appendChild(row);
    }
  } catch (error) {
    alert('Error loading payments: ' + error.message);
  }
}

// Login Functions
function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (username === "admin" && password === "123") {
    document.getElementById('login-screen').style.display = 'none';
    updateUserProfile(username, "Administration");
  } else {
    alert('Invalid username or password!');
  }
}

function updateUserProfile(username, role) {
  document.getElementById('profile-username').textContent = "Username (" + username + ")";
  document.getElementById('profile-role').textContent = role;
}

function logout() {
  document.querySelector('.user-profile-header').style.display = 'none';
  document.querySelector('.user-details-box').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  alert('Log Out Successfully!');
  // Reset form
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

// Module Switching
function showModule(moduleId) {
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.getElementById(moduleId).classList.add('active');

  if (moduleId === "reports") {
    document.getElementById("report-output").style.display = "block";
    generateReportsDashboard();
  } else {
    document.getElementById("report-output").style.display = "none";
  }

  if (moduleId === "users") {
    const username = document.getElementById('profile-username').textContent || "Username";
    const role = document.getElementById('profile-role').textContent || "Role";
    showUserProfile(username, role);
  }

  if (moduleId === "products") {
    editingProductId = null;
    document.querySelector('#productForm button[type="submit"]').textContent = "Add Product";
    document.getElementById('productForm').reset();
  }

  if (moduleId === "inventory") {
    updateProductDashboard();
  }

  if (moduleId === "orders") {
    updateProductDropdown();
  }

  if (moduleId === "payments") {
    updateOrderDropdown();
  }
}

// Default module
showModule('orders');

// Helper function to find product row by ID
function getProductRowByID(productID) {
  const rows = document.querySelectorAll("#productTable tr");
  for (let row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 1 && cells[0].textContent === productID) {
      return row;
    }
  }
  return null;
}

// Order Management
function generateOrderID() {
  return "OR-" + String(orderCounter).padStart(3, '0');
}

// Order Management
document.getElementById('orderForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const form = e.target;
  const orderData = {
    customer_name: form[0].value,
    product_id: parseInt(form[1].value.replace('PR-', '')),
    quantity: parseInt(form[2].value),
    status: form[3].value
  };
  if (orderData.customer_name && orderData.product_id && orderData.quantity) {
    try {
      if (editingOrderRow) {
        const orderId = editingOrderRow.cells[0].textContent.replace('OR-', '');
        const response = await fetch(`${API_BASE}/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
          cache: 'no-cache'
        });
        if (response.ok) {
          disableEditing(editingOrderRow);
          editingOrderRow = null;
          document.getElementById('orderSubmitBtn').textContent = "Add Order";
          loadOrders();
          loadPayments();
        } else {
          alert('Error updating order');
        }
      } else {
        const response = await fetch(`${API_BASE}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
          cache: 'no-cache'
        });
        if (response.ok) {
          // Success
        } else {
          alert('Error adding order');
        }
      }
      form.reset();
      loadOrders();
      loadPayments();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  } else {
    alert('Please fill in all fields.');
  }
});

function enableEditing(row) {
  const cells = row.querySelectorAll("td[data-field]");
  const customerName = cells[1].textContent;
  const productID = cells[2].textContent;
  oldQuantity = parseInt(cells[3].textContent);
  const status = cells[4].textContent;

  // Populate form
  const form = document.getElementById('orderForm');
  form[0].value = customerName;
  form[1].value = productID;
  form[2].value = oldQuantity;
  form[3].value = status;

  editingOrderRow = row;
  document.getElementById('orderSubmitBtn').textContent = "Update Order";
}

function disableEditing(row) {
  // Clear form
  document.getElementById('orderForm').reset();
  editingOrderRow = null;
  document.getElementById('orderSubmitBtn').textContent = "Add Order";
  oldQuantity = 0;
  updateOrderDropdown();
}

document.getElementById('orderTable').addEventListener('click', async function (e) {
  const row = e.target.closest("tr");

  if (e.target.classList.contains("edit-btn")) {
    enableEditing(row);
  }

  if (e.target.classList.contains("delete-btn")) {
    const orderId = row.cells[0].textContent.replace('OR-', '');
    try {
      const response = await fetch(`${API_BASE}/orders/${orderId}`, { method: 'DELETE', cache: 'no-cache' });
      if (response.ok) {
        loadOrders();
        loadPayments();
      } else {
        alert('Error deleting order');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }
});


// Order Search Functionality

// Order Search Input Handler
document.getElementById('orderSearch').addEventListener('input', function() {
  const query = this.value.toLowerCase().trim();
  const resultsDiv = document.getElementById('orderSearchResults');
  
  if (query.length < 2) {
    resultsDiv.style.display = 'none';
    return;
  }
  
  const matchingOrders = orders.filter(order => 
    `OR-${String(order.id).padStart(3, '0')}`.toLowerCase().includes(query) ||
    order.customer_name.toLowerCase().includes(query)
  );
  
  if (matchingOrders.length > 0) {
    resultsDiv.innerHTML = matchingOrders.map(order => 
      `<div class="search-result" data-order-id="${order.id}">
        OR-${String(order.id).padStart(3, '0')} - ${order.customer_name}
      </div>`
    ).join('');
    resultsDiv.style.display = 'block';
  } else {
    resultsDiv.style.display = 'none';
  }
});

// Handle Search Result Click
document.getElementById('orderSearchResults').addEventListener('click', function(e) {
  if (e.target.classList.contains('search-result')) {
    const orderId = parseInt(e.target.getAttribute('data-order-id'));
    const order = orders.find(o => o.id === orderId);
    if (order) {
      // Populate form
      const form = document.getElementById('orderForm');
      form[0].value = order.customer_name;
      form[1].value = `PR-${String(order.product_id).padStart(3, '0')}`;
      form[2].value = order.quantity;
      form[3].value = order.status;
      
      // Set editing mode
      editingOrderRow = { cells: [
        { textContent: `OR-${String(order.id).padStart(3, '0')}` },
        { textContent: order.customer_name },
        { textContent: `PR-${String(order.product_id).padStart(3, '0')}` },
        { textContent: order.quantity },
        { textContent: order.status }
      ]};
      oldQuantity = order.quantity;
      document.getElementById('orderSubmitBtn').textContent = "Update Order";
      
      // Hide results
      document.getElementById('orderSearchResults').style.display = 'none';
      document.getElementById('orderSearch').value = '';
    }
  }
});

// ===========================
// Product Search Functionality
// ===========================

// Product Search Input Handler
document.getElementById('productSearchInput').addEventListener('input', function() {
  const query = this.value.toLowerCase().trim();
  const resultsDiv = document.getElementById('productSearchResults');
  
  if (query.length < 2) {
    resultsDiv.style.display = 'none';
    return;
  }
  
  const matchingProducts = products.filter(product => 
    `PR-${String(product.id).padStart(3, '0')}`.toLowerCase().includes(query) ||
    product.name.toLowerCase().includes(query)
  );
  
  if (matchingProducts.length > 0) {
    resultsDiv.innerHTML = matchingProducts.map(product => 
      `<div class="search-result" data-product-id="${product.id}">
        PR-${String(product.id).padStart(3, '0')} - ${product.name}
      </div>`
    ).join('');
    resultsDiv.style.display = 'block';
  } else {
    resultsDiv.style.display = 'none';
  }
});

// Handle Product Search Result Click
document.getElementById('productSearchResults').addEventListener('click', function(e) {
  if (e.target.classList.contains('search-result')) {
    const productId = parseInt(e.target.getAttribute('data-product-id'));
    const product = products.find(p => p.id === productId);
    if (product) {
      // Populate form
      const form = document.getElementById('productForm');
      form[0].value = product.name;
      form[1].value = product.description;
      form[2].value = product.price;
      form[3].value = product.stock;
      form[4].value = product.image;
      
      editingProductId = product.id;
      document.querySelector('#productForm button[type="submit"]').textContent = "Update Product";
      
      document.getElementById('productSearchResults').style.display = 'none';
      document.getElementById('productSearchInput').value = '';
    }
  }
});

// ===========================
// Dropdown Updates
// ===========================
// Update product dropdown in orders
async function updateProductDropdown() {
  try {
    const response = await fetch(`${API_BASE}/products`, { cache: 'no-cache' });
    const products = await response.json();
    const datalist = document.getElementById('productList');
    datalist.innerHTML = '';
    products.forEach(product => {
      const option = document.createElement('option');
      option.value = `PR-${String(product.id).padStart(3, '0')}`;
      option.textContent = `${option.value} - ${product.name}`;
      datalist.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading products for dropdown:', error);
  }
}

// Update order dropdown in payments
async function updateOrderDropdown() {
  try {
    const response = await fetch(`${API_BASE}/orders`, { cache: 'no-cache' });
    const orders = await response.json();
    const datalist = document.getElementById('orderList');
    datalist.innerHTML = '';
    orders.forEach(order => {
      const option = document.createElement('option');
      option.value = `OR-${String(order.id).padStart(3, '0')}`;
      option.textContent = `${option.value} - ${order.customer_name}`;
      datalist.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading orders for dropdown:', error);
  }
}

// ===========================
// Form Handlers
// ===========================
// Product Management
document.getElementById('productForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const form = e.target;
  const productData = {
    name: form[0].value,
    description: form[1].value,
    price: parseFloat(form[2].value),
    stock: parseInt(form[3].value),
    image: form[4].value
  };
  if (productData.name && productData.description && productData.price && productData.stock && productData.image) {
    try {
      if (editingProductId !== null) {
        // Update existing product
        const response = await fetch(`${API_BASE}/products/${editingProductId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
          cache: 'no-cache'
        });
        if (response.ok) {
          loadProducts();
          loadOrders(); // In case product name changed
          loadPayments(); // In case price changed
          form.reset();
          editingProductId = null;
          document.querySelector('#productForm button[type="submit"]').textContent = "Add Product";
          alert('Product updated successfully!');
        } else {
          alert('Error updating product');
        }
      } else {
        // Add new product
        const response = await fetch(`${API_BASE}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
          cache: 'no-cache'
        });
        const result = await response.json();
        if (response.ok) {
          form.reset();
          loadProducts();
          alert('Product added successfully!');
        } else {
          alert('Error adding product: ' + result.message);
        }
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  } else {
    alert('Please fill in all fields.');
  }
});

// Product Table Actions
document.getElementById('productTable').addEventListener('click', async function (e) {
  const row = e.target.closest("tr");
  if (!row) return;

  if (e.target.classList.contains("edit-btn")) {
    const productId = parseInt(row.cells[0].textContent.replace('PR-', ''));
    try {
      const response = await fetch(`${API_BASE}/products/${productId}`, { cache: 'no-cache' });
      const product = await response.json();
      if (response.ok) {
        // Populate form
        const form = document.getElementById('productForm');
        form[0].value = product.name;
        form[1].value = product.description;
        form[2].value = product.price;
        form[3].value = product.stock;
        form[4].value = product.image;
        
        editingProductId = product.id;
        document.querySelector('#productForm button[type="submit"]').textContent = "Update Product";
      }
    } catch (error) {
      alert('Error loading product: ' + error.message);
    }
  }

  if (e.target.classList.contains("delete-btn")) {
    const productId = parseInt(row.cells[0].textContent.replace('PR-', ''));
    try {
      const response = await fetch(`${API_BASE}/products/${productId}`, { method: 'DELETE', cache: 'no-cache' });
      if (response.ok) {
        loadProducts();
        loadOrders();
        loadPayments();
        alert('Product deleted successfully!');
      } else {
        const error = await response.text();
        alert('Error deleting product: ' + error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }
});

// ===========================
// Dashboard and Reports
// ===========================
async function updateProductDashboard(filter = '') {
  const dashboard = document.getElementById('productDashboard');
  dashboard.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE}/products`, { cache: 'no-cache' });
    const products = await response.json();
    
    products.forEach(product => {
      const name = product.name.toLowerCase();
      if (filter && !name.includes(filter.toLowerCase())) return;

      const card = document.createElement('div');
      card.style.cssText = `
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 15px;
        width: 200px;
        text-align: center;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      `;
      card.innerHTML = `
        <img src="${product.image}" alt="${product.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 5px;">
        <h4>${product.name}</h4>
        <p>${product.description}</p>
        <p><strong>Price: $${product.price}</strong></p>
        <p>Qty: ${product.stock}</p>
      `;
      dashboard.appendChild(card);
    });
  } catch (error) {
    console.error('Error loading products for dashboard:', error);
  }
}

// Search functionality
document.getElementById('productSearch').addEventListener('input', function() {
  updateProductDashboard(this.value);
});

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  loadOrders();
  loadPayments();
  updateProductDashboard();
});

// Payment Management
document.getElementById('paymentForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const form = e.target;
  const orderId = parseInt(form[0].value.replace('OR-', ''));
  const discount = parseFloat(form[2].value) || 0;
  const paymentMethod = form[1].value;
  if (orderId && paymentMethod) {
    try {
      const response = await fetch(`${API_BASE}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, discount, payment_method: paymentMethod }),
        cache: 'no-cache'
      });
      if (response.ok) {
        loadOrders();
        loadPayments();
        form.reset();
        alert('Payment added successfully!');
      } else {
        alert('Error adding payment');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  } else {
    alert('Please fill in all fields.');
  }
});

// Function to update entire payment record when order details change
function updatePaymentForOrder(orderID) {
  const paymentRow = document.querySelector(`#paymentTable tr[data-order-id="${orderID}"]`);
  if (!paymentRow) return;

  // Find the order row
  const orderRows = document.querySelectorAll('#orderTable tr');
  let orderRow = null;
  for (let row of orderRows) {
    if (row.cells[0].textContent === orderID) {
      orderRow = row;
      break;
    }
  }
  if (!orderRow) return;

  const customerName = orderRow.cells[1].textContent;
  const productID = orderRow.cells[2].textContent;
  const quantity = parseFloat(orderRow.cells[3].textContent);
  const orderStatus = orderRow.cells[4].textContent;

  let productName = '';
  let productPrice = 0;
  const productsTable = document.getElementById('productTable').rows;
  for (let i = 0; i < productsTable.length; i++) {
    if (productsTable[i].cells[0].innerText === productID) {
      productName = productsTable[i].cells[1].innerText;
      productPrice = parseFloat(productsTable[i].cells[3].innerText) || 0;
      break;
    }
  }

  const total = quantity * productPrice;
  const paymentMethod = 'COD';
  const paymentStatus = orderStatus;

  const cells = paymentRow.querySelectorAll('td');
  cells[0].textContent = customerName;
  cells[1].textContent = productName;
  cells[2].textContent = quantity;
  cells[3].textContent = total.toFixed(2);
  cells[4].textContent = paymentMethod;
  cells[5].textContent = paymentStatus;
}

// Function to create payment record for a new order
function createPaymentForOrder(orderID, customerName, productID, quantity, orderStatus) {
  let productName = '';
  let productPrice = 0;
  const productsTable = document.getElementById('productTable').rows;
  for (let i = 0; i < productsTable.length; i++) {
    if (productsTable[i].cells[0].innerText === productID) {
      productName = productsTable[i].cells[1].innerText;
      productPrice = parseFloat(productsTable[i].cells[3].innerText) || 0;
      break;
    }
  }

  const total = quantity * productPrice;
  const paymentMethod = 'COD';
  const paymentStatus = orderStatus; // Mirrors order status

  const row = document.createElement('tr');
  row.setAttribute('data-date', new Date().toISOString().split('T')[0]);
  row.setAttribute('data-order-id', orderID);
  row.innerHTML = `
    <td>${customerName}</td>
    <td>${productName}</td>
    <td>${quantity}</td>
    <td>${total.toFixed(2)}</td>
    <td>${paymentMethod}</td>
    <td>${paymentStatus}</td>
  `;
  document.getElementById('paymentTable').appendChild(row);
}

// User Management
function showUserProfile(username, role) {
  document.querySelector('.user-profile-header').style.display = 'flex';
  document.querySelector('.user-details-box').style.display = 'block';
  document.getElementById('profile-username').innerText = username;
  document.getElementById('profile-role').innerText = role;
}

// ===========================
// Reports
// ===========================
if (!window.Chart) {
  const script = document.createElement('script');
  script.src = "https://cdn.jsdelivr.net/npm/chart.js";
  document.head.appendChild(script);
}

function createReportCard(title, value, id, color="#800000") {
  return `
    <div class="report-card" id="${id}" style="background:${color}; color:white; padding:20px; border-radius:10px; flex:1; margin:10px; box-shadow:0 4px 10px rgba(0,0,0,0.2); transition: transform 0.3s;">
      <h3>${title}</h3>
      <p style="font-size:2rem; font-weight:bold;">${value}</p>
      <canvas id="${id}-chart" style="width:100%; height:150px; margin-top:10px;"></canvas>
    </div>
  `;
}

async function generateReportsDashboard() {
  try {
    const [productsRes, ordersRes, paymentsRes] = await Promise.all([
      fetch(`${API_BASE}/products`, { cache: 'no-cache' }),
      fetch(`${API_BASE}/orders`, { cache: 'no-cache' }),
      fetch(`${API_BASE}/payments`, { cache: 'no-cache' })
    ]);
    const products = await productsRes.json();
    const orders = await ordersRes.json();
    const payments = await paymentsRes.json();

    let pending=0, completed=0, canceled=0;
    orders.forEach(o => {
      if(o.status==="Pending") pending++;
      if(o.status==="Completed") completed++;
      if(o.status==="Canceled") canceled++;
    });

    let low=0, normal=0, high=0;
    products.forEach(p=>{
      const qty = p.stock;
      if(qty<=5) low++;
      else if(qty<=20) normal++;
      else high++;
    });

    // Calculate inventory count
    const inventoryCount = products.length;

  // Calculate top sales (product with most quantity sold)
  const salesMap = {};
  orders.forEach(o => {
    const productID = `PR-${String(o.product_id).padStart(3, '0')}`;
    salesMap[productID] = (salesMap[productID] || 0) + o.quantity;
  });
  const topProduct = Object.keys(salesMap).reduce((a, b) => salesMap[a] > salesMap[b] ? a : b, '') || 'None';
  const topSalesQty = salesMap[topProduct] || 0;

  // Calculate daily sales
  const dailySales = {};
  payments.forEach(p => {
    const order = orders[p.order_id - 1];
    const product = products[order.product_id - 1];
    const total = order.quantity * product.price * (1 - p.discount / 100);
    const date = new Date().toISOString().split('T')[0]; // Assuming current date for simplicity
    dailySales[date] = (dailySales[date] || 0) + total;
  });
  const dailyLabels = Object.keys(dailySales).sort();
  const dailyData = dailyLabels.map(d => dailySales[d]);

  // Calculate monthly sales
  const monthlySales = {};
  payments.forEach(p => {
    const date = new Date().toISOString().split('T')[0];
    const month = date.substring(0, 7); // YYYY-MM
    const order = orders[p.order_id - 1];
    const product = products[order.product_id - 1];
    const total = order.quantity * product.price * (1 - p.discount / 100);
    monthlySales[month] = (monthlySales[month] || 0) + total;
  });
  const monthlyLabels = Object.keys(monthlySales).sort();
  const monthlyData = monthlyLabels.map(m => monthlySales[m]);

  // Top products bar chart
  const topProducts = Object.entries(salesMap).sort((a,b) => b[1] - a[1]).slice(0,5);
  const topLabels = topProducts.map(p => p[0]);
  const topData = topProducts.map(p => p[1]);

  // Invoice chart (daily invoices)
  const invoiceDaily = {};
  payments.forEach(p => {
    const date = new Date().toISOString().split('T')[0];
    invoiceDaily[date] = (invoiceDaily[date] || 0) + 1;
  });
  const invoiceLabels = Object.keys(invoiceDaily).sort();
  const invoiceData = invoiceLabels.map(d => invoiceDaily[d]);

  document.getElementById("report-output").innerHTML = `
    <div style="display:flex; flex-wrap:wrap;">
      ${createReportCard("Sales Report", orders.length, "sales-card")}
      ${createReportCard("Inventory Count", inventoryCount, "inventory-count-card", "#ff8c00")}
      ${createReportCard("Top Sales: " + topProduct, topSalesQty, "top-sales-card", "#2e8b57")}
      <div class="report-card" style="background:#800080; color:white; padding:20px; border-radius:10px; flex:1; margin:10px; box-shadow:0 4px 10px rgba(0,0,0,0.2);">
        <h3>Daily Sales</h3>
        <canvas id="daily-sales-chart" style="width:100%; height:150px; margin-top:10px;"></canvas>
      </div>
      <div class="report-card" style="background:#daa520; color:white; padding:20px; border-radius:10px; flex:1; margin:10px; box-shadow:0 4px 10px rgba(0,0,0,0.2);">
        <h3>Monthly Sales</h3>
        <canvas id="monthly-sales-chart" style="width:100%; height:150px; margin-top:10px;"></canvas>
      </div>
      <div class="report-card" style="background:#dc143c; color:white; padding:20px; border-radius:10px; flex:1; margin:10px; box-shadow:0 4px 10px rgba(0,0,0,0.2);">
        <h3>Top Products</h3>
        <canvas id="top-products-chart" style="width:100%; height:150px; margin-top:10px;"></canvas>
      </div>
      <div class="report-card" style="background:#00ced1; color:white; padding:20px; border-radius:10px; flex:1; margin:10px; box-shadow:0 4px 10px rgba(0,0,0,0.2);">
        <h3>Invoice Chart</h3>
        <canvas id="invoice-chart" style="width:100%; height:150px; margin-top:10px;"></canvas>
      </div>
    </div>
  `;

  document.querySelectorAll('.report-card').forEach((card, idx) => {
    card.style.transform = "translateY(20px)";
    card.style.opacity = "0";
    setTimeout(() => {
      card.style.transition = "all 0.5s ease";
      card.style.transform = "translateY(0)";
      card.style.opacity = "1";
    }, idx * 150);
  });

  drawCardChart("sales-card-chart", ["Pending","Completed","Canceled"], [pending, completed, canceled], "rgba(255,255,255,0.8)");
  drawCardChart("inventory-count-card-chart", ["Products"], [inventoryCount], "rgba(255,255,255,0.8)");
  drawCardChart("top-sales-card-chart", ["Top Product"], [topSalesQty], "rgba(255,255,255,0.8)");
  drawCardChart("inventory-card-chart", ["Low","Normal","High"], [low, normal, high], "rgba(255,255,255,0.8)");
  drawCardChart("invoice-card-chart", ["Invoices"], [payments.length], "rgba(255,255,255,0.8)");

  // Draw line charts
  drawLineChart("daily-sales-chart", dailyLabels, dailyData, "Daily Sales ($)");
  drawLineChart("monthly-sales-chart", monthlyLabels, monthlyData, "Monthly Sales ($)");
  drawBarChart("top-products-chart", topLabels, topData, "Top Products (Qty Sold)");
  drawLineChart("invoice-chart", invoiceLabels, invoiceData, "Daily Invoices");
  } catch (error) {
    console.error('Error generating reports:', error);
  }
}

// ===========================
// Chart Functions
// ===========================

function drawCardChart(canvasId, labels, data, color) {
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          "rgba(255,255,255,0.8)",
          "rgba(255,255,255,0.6)",
          "rgba(255,255,255,0.4)"
        ],
        borderWidth: 0
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      cutout: "70%"
    }
  });
}

function drawLineChart(canvasId, labels, data, label) {
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        borderColor: 'rgba(255,255,255,1)',
        backgroundColor: 'rgba(255,255,255,0.2)',
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function drawBarChart(canvasId, labels, data, label) {
  const ctx = document.getElementById(canvasId);
  if(!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderColor: 'rgba(255,255,255,1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}
