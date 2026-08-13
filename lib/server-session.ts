import { auth } from "@/lib/auth";

export async function getAuthenticatedEmail(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.email || null;
}
