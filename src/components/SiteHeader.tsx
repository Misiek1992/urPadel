import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import { Logo } from "@/components/Logo";
import { getViewer } from "@/lib/auth";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0">
          <Logo size={30} />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link href="/clubs" className="btn btn-ghost btn-sm">
            Clubs
          </Link>
          {viewer.managedClubs.length > 0 && (
            <Link href="/manager" className="btn btn-ghost btn-sm">
              Club manager
            </Link>
          )}
          {viewer.isSuperAdmin && (
            <Link href="/superadmin" className="btn btn-ghost btn-sm">
              Super admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn btn-primary btn-sm">Sign in</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
