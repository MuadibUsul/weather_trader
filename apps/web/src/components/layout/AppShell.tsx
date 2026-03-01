import { ReactNode } from "react";
import { TopStatusBar } from "@/components/global/TopStatusBar";
import { SidebarNav } from "@/components/global/SidebarNav";

type Props = {
  activeRoute: string;
  main: ReactNode;
  right?: ReactNode;
  mainClassName?: string;
};

export function AppShell({ activeRoute, main, right, mainClassName }: Props) {
  return (
    <div className="bg-background-dark text-text-main font-display antialiased min-h-screen flex flex-col">
      <TopStatusBar />
      <main className="flex-1 p-3 lg:p-4 grid grid-cols-12 gap-3 lg:gap-4 overflow-hidden h-[calc(100vh-64px)]">
        <SidebarNav active={activeRoute} />
        <section
          className={`col-span-12 md:col-span-9 ${
            right ? "lg:col-span-7" : "lg:col-span-10"
          } flex flex-col gap-3 lg:gap-4 h-full overflow-hidden ${mainClassName ?? ""}`}
        >
          {main}
        </section>
        {right ? <aside className="col-span-12 md:col-span-3 lg:col-span-3 flex flex-col gap-3 lg:gap-4">{right}</aside> : null}
      </main>
    </div>
  );
}

