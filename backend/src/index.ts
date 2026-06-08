import express from "express";
import "dotenv/config";
import { PrismaClient } from "../prisma/generated/prisma/client";
import { signupSchema } from "./utils/schema";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5000",
    credentials: true,
  }),
);

const saltRound = 10;

const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",

  maxAge: 24 * 60 * 60 * 1000, // 1 day
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
};

app.get("/", (req, res) => {
  res.send("Hello via Bun!");
});

const BALANCES = {
  userId1: {
    SOL: {
      totalBalance: 0,
      lockedBalance: 0,
    },
    USD: {
      totalBalance: 0,
      lockedBalance: 0,
    },
  },
};

const ORDERBOOKS = {
  axisb: {
    bids: [],
    asks: [],
    lastTradedPrice: 0,
  },
  btc: {
    bids: [],
    asks: [],
    lastTradedPrice: 0,
  },
  sol: {
    bids: [],
    asks: [],
    lastTradedPrice: 0,
  },
};

app.post("/signup", async (req, res) => {
  try {
    // validate request body
    const body = req.body;
    const validatedData = signupSchema.parse(body);
    // check email already exist ?
    const existingUser = await prisma.users.findUnique({
      where: {
        email: validatedData.email,
      },
    });
    if (existingUser) {
      return res.status(400).json({
        error: "Email Already Exists!",
      });
    }

    // check for username availability
    const usernameTaken = await prisma.users.findUnique({
      where: {
        username: validatedData.username,
      },
    });
    if (usernameTaken) {
      return res.status(400).json({
        error: "Username Already Taken!",
      });
    }
    // hash password & create user in database
    const incomingUser = {
      email: validatedData.email,
      username: validatedData.username,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      password: bcrypt.hash(validatedData.password, saltRound),
    };
    const createdUser = await prisma.users.create({
      data: incomingUser,
    });
    // create session for user
    if (createdUser) {
      const token = jwt.sign(
        {
          userId: createdUser.id,
          username: createdUser.username,
          email: createdUser.email,
          firstName: createdUser.firstName,
          lastName: createdUser.lastName,
        },
        process.env.JWT_SECRET || "default_secret_CEX_backend",
        {
          expiresIn: "1d",
        },
      );
    }
    // send response with cookie containing session token
  } catch (error) {}
});

app.post("/login", (req, res) => {
  // check if session already exists
  // if exists then terminate that session
  // create a fresh session and generate token here
  // send token in cookie response
  // redirect to homepage or the page where login was clicked
  //
});

app.post("/logout", (req, res) => {
  // terminate session
  // clear cookies
  // redirect to homepage or login page
});

// all amounts and numbers to be handled in rounded up integer, floats, decimals not to be used

app.post("/order", (req, res) => {
  // creates order
  //
  // return orderId, filledQty, totalPrice
});

app.get("/order/:orderId", (req, res) => {
  const { orderId } = req.params;
});

app.delete("/order/:orderId", (req, res) => {
  const { orderId } = req.params;
});

app.get("/orders", (req, res) => {});
app.get("/fills", (req, res) => {});

// depth is orderbook
app.get("/depth/:symbol", (req, res) => {
  const { symbol } = req.params;
});

app.get("/balance/usd", (req, res) => {});
app.get("/balance", (req, res) => {});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
