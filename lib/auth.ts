import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/db"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { authConfig } from "@/auth.config"

// Define schema for input validation
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        const parsedCredentials = loginSchema.safeParse(credentials);

        if (parsedCredentials.success) {
            const { email, password } = parsedCredentials.data;
            const user = await db.user.findUnique({
                 where: { email } 
            });

            if (!user || !user.password) return null;

            const passwordsMatch = await bcrypt.compare(password, user.password);
            if (passwordsMatch) return user;
        }

        return null;
      }
    })
  ],
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      // Add role to session if needed
       if (token.role && session.user) {
         // @ts-ignore
         session.user.role = token.role;
       }
      return session;
    },
    async jwt({ token }) {
      if (!token.sub) return token;
      
      const existingUser = await db.user.findUnique({
        where: { id: token.sub }
      });
      
      if (!existingUser) return token;

      // Assign role to token
      // @ts-ignore
      token.role = existingUser.role;

      return token;
    }
  }
})
