import type { ReactNode } from "react";
import Navbar from "./Navbar";
import type { SessionUser } from "@/lib/session";

type Props = {
  children: ReactNode;
  hideNav?: boolean;
  user?: SessionUser;
};

export default function Layout({ children, hideNav = false, user }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {!hideNav && <Navbar user={user} />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
