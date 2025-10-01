const express = require('express');
const dotenv = require("dotenv");
const cors = require('cors');


dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'] 
  }))

PORT = process.env.PORT || 5000;


//Routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/auth', userRoutes);

const bookingRoutes = require('./routes/bookingRoutes');
app.use('/api/bookings', bookingRoutes);

const auditLogRoutes = require('./routes/auditLog.routes');
app.use('/api/audit-history', auditLogRoutes);

const internalInvoiceRoutes = require('./routes/internalInvoiceRoutes');
app.use('/api/reports/internal-invoicing', internalInvoiceRoutes);

const transactionRoutes = require('./routes/transactionRoutes')
app.use('/api/transactions', transactionRoutes);

const supplierReportRoutes = require('./routes/supplierReportRoutes');
app.use('/api/supplier-reports', supplierReportRoutes);


app.listen(PORT, () => {
    console.log("server is running on Port " + PORT);
});