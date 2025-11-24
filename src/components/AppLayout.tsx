import { ReactNode } from "react";
import { AppDrawer } from "./AppDrawer";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <AppDrawer />
      <main className="pl-0">{children}</main>
    </div>
  );
};
