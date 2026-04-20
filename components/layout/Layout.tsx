import type { ReactNode } from "react";
import Navbar from "./Navbar";

type Props = {
  children: ReactNode;
  hideNav?: boolean;
};

export default function Layout({ children, hideNav = false }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {!hideNav && <Navbar />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
