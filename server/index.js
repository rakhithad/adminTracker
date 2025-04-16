const express = require('express');
const dotenv = require("dotenv");

dotenv.config();

const app = express();
PORT = process.env.PORT || 5000;


//Routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

const bookingRoutes = require('./routes/bookingRoutes');
app.use('/api/bookings', bookingRoutes);



app.listen(PORT, () => {
    console.log("server is running on Port " + PORT);
});