import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SuperAdminNav } from "@/components/superadmin/SuperAdminNav";

export const metadata: Metadata = {
  title: "Super admin",
};

export default function SuperAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Super admin
        </h1>
        <SuperAdminNav />
      </div>
      {children}
    </div>
  );
}
