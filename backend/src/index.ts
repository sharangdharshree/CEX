import express from "express";
import "dotenv/config";
import { PrismaClient } from "../prisma/generated/prisma/client";
import { signupSchema, singinSchema } from "./utils/schema";
import * as bcrypt from "bcrypt";
import jwt, {
  type Secret,
  type SignOptions,
  type JwtPayload,
} from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";
import { PrismaPg } from "@prisma/adapter-pg";
import z, { boolean } from "zod";
import { error } from "node:console";

const app = express();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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
      password: await bcrypt.hash(validatedData.password, saltRound),
    };
    const createdUser = await prisma.users.create({
      data: incomingUser,
    });
    // create refresh session token for user, feed into sessions table

    const token = jwt.sign(
      {
        userId: createdUser.id,
        username: createdUser.username,
        email: createdUser.email,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
      },
      (process.env.JWT_REFRESH_SECRET as Secret) ||
        "default_refresh_secret_CEX_backend",
      {
        algorithm: "HS256",
        expiresIn: (process.env.JWT_REFRESH_EXPIRATION ??
          "7d") as SignOptions["expiresIn"],
      },
    );

    // store this token in sessions table with userId and expiry
    const session = await prisma.sessions.create({
      data: {
        userId: createdUser.id,
        username: createdUser.username,
        refreshToken: token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
    // send response with cookie containing session token

    const accessToken = jwt.sign(
      {
        sessionId: session.id,
        username: createdUser.username,
        email: createdUser.email,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
      },
      process.env.JWT_ACCESS_SECRET ?? "default_access_secret_CEX_backend",
      {
        algorithm: "HS256",
        expiresIn: (process.env.JWT_ACCESS_EXPIRATION ??
          "1d") as jwt.SignOptions["expiresIn"],
      },
    );

    res
      .cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      })
      .status(201)
      .json({
        message: "User created successfully!",
      });
  } catch (error: any) {
    console.error("Error during signup:", error);
    res.status(500).json({
      error: "Unexpected Internal Server Error:\n" + error.message,
    });
  }
});

app.post("/signin", async (req, res) => {
  try {
    // receive incomings
    const incoming = req.body;
    const validatedData = singinSchema.parse(incoming);

    // check if username and password is valid
    const user = await prisma.users.findFirst({
      where: {
        username: validatedData.username,
      },
    });
    if (!user) {
      return res.status(500).json({
        error: "User Not Found!",
      });
    }

    const passwordMatch = await bcrypt.compare(
      validatedData.password,
      user.password,
    );

    if (!passwordMatch) {
      res.status(401).json({
        error: "Invalid Password!",
      });
    }

    // check if session already exists
    const existingSession = await prisma.sessions.findFirst({
      where: {
        username: user.username,
      },
    });
    // if exists then terminate that session
    if (existingSession) {
      try {
        const revokeSession = await prisma.sessions.updateMany({
          where: {
            username: user.username,
            status: "ACTIVE",
          },
          data: {
            status: "REVOKED",
            revokedAt: new Date().getTime().toString(),
          },
        });
      } catch (err: any) {
        // add retry logic
        res.status(500).json({
          error: "Unexpected Internal Server Error:\n" + err.message,
        });
      }
    }

    // create a fresh and generate token and session
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      (process.env.JWT_REFRESH_SECRET as Secret) ||
        "default_refresh_secret_CEX_backend",
      {
        algorithm: "HS256",
        expiresIn: (process.env.JWT_REFRESH_EXPIRATION ??
          "7d") as SignOptions["expiresIn"],
      },
    );

    const newSession = await prisma.sessions.create({
      data: {
        userId: user.id,
        username: user.username,
        refreshToken: refreshToken!,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    const accessToken = jwt.sign(
      {
        sessionId: newSession.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      process.env.JWT_ACCESS_SECRET ?? "default_access_secret_CEX_backend",
      {
        algorithm: "HS256",
        expiresIn: (process.env.JWT_ACCESS_EXPIRATION ??
          "1d") as jwt.SignOptions["expiresIn"],
      },
    );
    // send token in cookie response
    res
      .cookie("accessToken", accessToken, {
        ...cookieOptions,
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      })
      .status(201)
      .json({
        message: "User signed in successfully!",
      });
    // redirect to homepage or the page where login was clicked
    //
  } catch (error) {}
});

app.post("/signout", async (req, res) => {
  try {
    // terminate session
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      res.status(500).json({
        error: "No tokens received!",
      });
    }
    const decoded = jwt.verify(
      accessToken,
      process.env.JWT_ACCESS_SECRET ?? "default_access_secret_CEX_backend",
    ) as JwtPayload;

    const user = await prisma.users.findUnique({
      where: {
        username: decoded.username,
        email: decoded.email,
      },
    });

    if (!user) {
      res.status(500).json({
        error: "Invalid Request, No Such User!",
      });
    }
    // revoke session, clear refreshToken

    const revokedSession = await prisma.sessions.update({
      where: {
        id: decoded.sessionId,
        userId: user?.id,
      },
      data: {
        refreshToken: "",
        status: "REVOKED",
        revokedAt: new Date().getTime().toString(),
      },
    });

    // then clear cookies and redirect to homepage or login page
    res
      .clearCookie("accessToken", cookieOptions)
      .status(200)
      .json({
        message: "User Signed-Out Successfully!",
      })
      .redirect("/signin");
  } catch (err: any) {
    res.status(500).json({
      error: "Unexpected Internal Server Error:\n" + err.message,
    });
  }
});

app.post("/refresh-access-token", async (req, res) => {
  try {
    const incomingToken = req.cookies.accessToken;
    const decoded = jwt.verify(
      incomingToken,
      process.env.JWT_ACCESS_SECRET ?? "default_access_secret_CEX_backend",
    ) as JwtPayload;

    const session = await prisma.sessions.findUnique({
      where: {
        id: decoded.sessionId,
        username: decoded.username,
      },
    });

    if (!session) {
      res.status(401).json({
        error: "Not Session Found!",
      });
    }
    const refreshToken = session?.refreshToken!;
    jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET ?? "default_refresh_secret_CEX_backend",
      (err, decode) => {
        if (err) {
          res
            .clearCookie("accessToken", cookieOptions)
            .status(401)
            .json({
              error: "No Valid Refresh Token",
            })
            .redirect("/signin");
        } else if (!err && decode) {
          const newAccessToken = jwt.sign(
            {
              sessionId: session?.id!,
              username: decoded.username,
              email: decoded.email,
              firstName: decoded.firstName,
              lastName: decoded.lastName,
            },
            process.env.JWT_ACCESS_SECRET ??
              "default_access_secret_CEX_backend",
            {
              algorithm: "HS256",
              expiresIn: (process.env.JWT_ACCESS_EXPIRATION ??
                "1d") as jwt.SignOptions["expiresIn"],
            },
          );
          res
            .cookie("accessToken", newAccessToken, {
              ...cookieOptions,
              maxAge: 24 * 60 * 60 * 1000, // 1 day
              expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
            })
            .status(201)
            .json({
              message: "Access token refreshed successfully!",
            });
        }
      },
    );
  } catch (err: any) {
    res.status(500).json({
      error: "Unexpected Internal Server Error:\n" + err.message,
    });
  }
});

// all amounts and numbers to be handled in rounded up integer, floats, decimals not to be used

app.post("/order", (req, res) => {
  try {
    // creates order
    //
    // return orderId, filledQty, totalPrice
  } catch (err: any) {
    res.status(500).json({
      error: "Unexpected Internal Server Error:\n" + err.message,
    });
  }
});

app.get("/order/:orderId", (req, res) => {
  try {
    const { orderId } = req.params;
  } catch (err: any) {
    res.status(500).json({
      error: "Unexpected Internal Server Error:\n" + err.message,
    });
  }
});

app.delete("/order/:orderId", (req, res) => {
  try {
    const { orderId } = req.params;
  } catch (err: any) {
    res.status(500).json({
      error: "Unexpected Internal Server Error:\n" + err.message,
    });
  }
});

app.get("/orders", (req, res) => {
  try {
  } catch (err: any) {
    res.status(500).json({
      error: "Unexpected Internal Server Error:\n" + err.message,
    });
  }
});
app.get("/fills", (req, res) => {
  try {
  } catch (err: any) {
    res.status(500).json({
      error: "Unexpected Internal Server Error:\n" + err.message,
    });
  }
});

// depth is orderbook
app.get("/depth/:symbol", (req, res) => {
  try {
    const { symbol } = req.params;
  } catch (err: any) {
    res.status(500).json({
      error: "Unexpected Internal Server Error:\n" + err.message,
    });
  }
});

app.get("/balance/usd", (req, res) => {
  try {
  } catch (err: any) {
    res.status(500).json({
      error: "Unexpected Internal Server Error:\n" + err.message,
    });
  }
});
app.get("/balance", (req, res) => {
  try {
  } catch (err: any) {
    res.status(500).json({
      error: "Unexpected Internal Server Error:\n" + err.message,
    });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
