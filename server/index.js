const express = require('express');
const dotenv = require("dotenv");
const cors = require('cors');


dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
  }))

PORT = process.env.PORT || 5000;


//Routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

const bookingRoutes = require('./routes/bookingRoutes');
app.use('/api/bookings', bookingRoutes);



app.listen(PORT, () => {
    console.log("server is running on Port " + PORT);
});