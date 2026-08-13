import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { syncUserToNeo4j } from "./neo4j-sync";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  baseURL: process.env.BETTER_AUTH_URL,

  trustedOrigins: [
    "http://localhost:3000",
    "https://gi-smart-teal.vercel.app",
  ],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  user: {
    additionalFields: {
      goal: {
        type: "string",
        defaultValue: "General Health",
      },
      role: {
        type: "string",
        defaultValue: "user",
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user: any) => {
          await syncUserToNeo4j({
            id: user.id,
            email: user.email,
            name: user.name,
            goal: user.goal,
          });
        },
      },
    },
  },
});
