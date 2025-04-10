const express = require('express');
const dotenv = require("dotenv");

dotenv.config();

const app = express();
PORT = process.env.PORT || 5000;

app.get("/test", (req,res) => {
    res.send("hello from backend");
})



app.listen(PORT, () => {
    console.log("server is running on Port " + PORT);
});