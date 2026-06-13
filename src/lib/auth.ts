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
      if (!profile?.sub) return false;
      await ensureUserAndHousehold(db, {
        lineUserId: profile.sub as string,
        displayName: (profile.name as string) ?? "User",
        pictureUrl: (profile.picture as string) ?? null,
      });
      return true;
    },
    async session({ session, token }) {
      const lineUserId = token.sub!;
      const user = await db.user.findUnique({ where: { lineUserId } });
      if (user) {
        (session as any).user.id = user.id;
        (session as any).user.householdId = user.householdId;
        (session as any).user.lineUserId = user.lineUserId;
      }
      return session;
    },
  },
});
