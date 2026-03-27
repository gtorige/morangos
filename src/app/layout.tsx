"use client";

import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import {
  Home,
  Plus,
  ClipboardList,
  Users,
  Package,
  Tag,
  Receipt,
  BarChart3,
  MapPin,
  Menu,
  ClipboardCheck,
  Repeat,
  Shield,
  LogOut,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const navItems = [
  { href: "/", label: "Início", icon: Home },
  { href: "/resumo", label: "Resumo", icon: BarChart3 },
  { href: "/pedidos/novo", label: "Novo Pedido", icon: Plus },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/recorrentes", label: "Pedidos Recorrentes", icon: Repeat },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/promocoes", label: "Promoções", icon: Tag },
  { href: "/contas", label: "Fornecedores", icon: Receipt },
  { href: "/rota", label: "Rota de Entrega", icon: MapPin },
  { href: "/separacao", label: "Separação", icon: ClipboardCheck },
];

const adminItems = [
  { href: "/admin/usuarios", label: "Usuários", icon: Shield },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;
  const username = (session?.user as { username?: string })?.username;
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  async function handleChangePassword() {
    setPwError("");
    setPwSuccess(false);
    if (!senhaAtual || !novaSenha) {
      setPwError("Preencha ambos os campos.");
      return;
    }
    if (novaSenha.length < 4) {
      setPwError("Mínimo 4 caracteres.");
      return;
    }
    setPwSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senhaAtual, novaSenha }),
    });
    if (!res.ok) {
      const data = await res.json();
      setPwError(data.error || "Erro ao alterar senha.");
      setPwSaving(false);
      return;
    }
    setPwSaving(false);
    setPwSuccess(true);
    setSenhaAtual("");
    setNovaSenha("");
    setTimeout(() => { setShowPasswordForm(false); setPwSuccess(false); }, 2000);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="text-xl font-bold tracking-tight text-primary">Gestão</span>
      </div>
      <Separator />
      <nav className="flex-1 flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <Separator className="my-2" />
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {session?.user && (
        <>
          <Separator />
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {session.user.name || username}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{username}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setShowPasswordForm(!showPasswordForm);
                setPwError("");
                setPwSuccess(false);
                setSenhaAtual("");
                setNovaSenha("");
              }}
            >
              <KeyRound className="h-4 w-4" />
              Alterar Senha
            </Button>
            {showPasswordForm && (
              <div className="px-3 space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Senha Atual</Label>
                  <Input
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    placeholder="••••••••"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nova Senha</Label>
                  <Input
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="••••••••"
                    className="h-8 text-sm"
                  />
                </div>
                {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                {pwSuccess && <p className="text-xs text-green-500">Senha alterada!</p>}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleChangePassword}
                  disabled={pwSaving}
                >
                  {pwSaving ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const noShellPages = ["/login", "/setup"];
  if (noShellPages.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <SessionProvider>
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b bg-background px-4 py-3 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" />}
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="text-lg font-bold tracking-tight text-primary">
          Gestão
        </span>
      </header>

      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-background">
          <SidebarContent />
        </aside>

        {/* Main content */}
        <main className="flex-1 md:ml-64 min-w-0 overflow-x-hidden">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </SessionProvider>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <title>Gestão de Morangos</title>
        <meta
          name="description"
          content="Sistema de gestão de pedidos e entregas"
        />
      </head>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
