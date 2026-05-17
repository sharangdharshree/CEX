import express from "express";
import "dotenv/config";

const app = express();

app.get("/", (req, res) => {
  res.send("Hello via Bun!");
});

const BALANCES = {
  SOL: {},
  USD: {},
};

const ORDERBOOKS = {};

app.post("/signup", (req, res) => {});

app.post("/signin", (req, res) => {});

app.post("/order", (req, res) => {});

app.get("/order/:orderId", (req, res) => {
  const { orderId } = req.params;
});

app.delete("/order/:orderId", (req, res) => {
  const { orderId } = req.params;
});

app.get("/depth/:sym", (req, res) => {
  const { sym } = req.params;
});
app.get("/orders", (req, res) => {});
app.get("/fills", (req, res) => {});
app.get("/balance/usd", (req, res) => {});
app.get("/balance", (req, res) => {});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
