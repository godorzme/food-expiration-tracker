import NextAuth from "next-auth";
import LineProvider from "next-auth/providers/line";
import { db } from "@/lib/db";
import { ensureUserAndHousehold } from "@/lib/household";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    LineProvider({
      clientId: process.env.LINE_LOGIN_CHANNEL_ID!,
      clientSecret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
      authorization: { params: { scope: "openid profile" } },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      return !!profile?.sub;
    },
    async jwt({ token, profile }) {
      // `profile` is present only on the initial sign-in; do DB work once here
      // instead of on every request in the session callback.
      if (profile?.sub) {
        const user = await ensureUserAndHousehold(db, {
          lineUserId: profile.sub as string,
          displayName: (profile.name as string) ?? "User",
          pictureUrl: (profile.picture as string) ?? null,
        });
        token.uid = user.id;
        token.householdId = user.householdId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid;
        session.user.householdId = token.householdId ?? "";
        session.user.lineUserId = token.sub ?? "";
      }
      return session;
    },
  },
});
