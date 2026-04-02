"use client";

import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, DM_Sans } from "next/font/google";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import {
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
  Settings,
  Truck,
  AlertTriangle,
  DollarSign,
  GripVertical,
  Pencil,
  Check,
  Sprout,
  Warehouse,
  Bell,
  X,
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
import pkg from "../../package.json";
import "./globals.css";

const appVersion = pkg.version;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const navItems = [
  { href: "/resumo", label: "Resumo", icon: BarChart3 },
  { href: "/pedidos/novo", label: "Novo Pedido", icon: Plus, highlight: true },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/recorrentes", label: "Pedidos Recorrentes", icon: Repeat },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/promocoes", label: "Promoções", icon: Tag },
  { href: "/producao", label: "Produção", icon: Sprout },
  { href: "/estoque", label: "Estoque", icon: Warehouse },
  { href: "/contas", label: "Financeiro", icon: Receipt },
  { href: "/separacao", label: "Separação", icon: ClipboardCheck },
  { href: "/rota", label: "Rota de Entrega", icon: MapPin },
  { href: "/entrega", label: "Modo Entrega", icon: Truck },
];

interface NavSection { label: string; items: string[] }

const DEFAULT_SECTIONS: NavSection[] = [
  { label: "Vendas", items: ["/resumo", "/pedidos/novo", "/pedidos", "/recorrentes"] },
  { label: "Cadastros", items: ["/clientes", "/produtos", "/promocoes"] },
  { label: "Operações", items: ["/producao", "/estoque", "/separacao", "/rota", "/entrega"] },
  { label: "Financeiro", items: ["/contas"] },
];

const adminItems = [
  { href: "/admin/usuarios", label: "Usuários", icon: Shield },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

const MENU_ORDER_KEY = "menu-sections";

const navItemMap = new Map(navItems.map((item) => [item.href, item]));

function getSavedSections(): NavSection[] {
  if (typeof window === "undefined") return DEFAULT_SECTIONS;
  try {
    const saved = localStorage.getItem(MENU_ORDER_KEY);
    if (!saved) return DEFAULT_SECTIONS;
    const parsed: NavSection[] = JSON.parse(saved);
    // Validate: ensure all current navItems are present
    const allHrefs = new Set(navItems.map((i) => i.href));
    const savedHrefs = new Set(parsed.flatMap((s) => s.items));
    // Remove stale hrefs
    const cleaned = parsed.map((s) => ({
      ...s,
      items: s.items.filter((h) => allHrefs.has(h)),
    })).filter((s) => s.items.length > 0);
    // Add any new items not in saved
    const missing = navItems.filter((i) => !savedHrefs.has(i.href));
    if (missing.length > 0) {
      if (cleaned.length > 0) {
        cleaned[0].items.push(...missing.map((i) => i.href));
      } else {
        return DEFAULT_SECTIONS;
      }
    }
    return cleaned;
  } catch {
    return DEFAULT_SECTIONS;
  }
}

function saveSections(sections: NavSection[]) {
  try {
    localStorage.setItem(MENU_ORDER_KEY, JSON.stringify(sections));
  } catch {}
}

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

  // Menu reorder state — sections with items
  const [sections, setSections] = useState<NavSection[]>(DEFAULT_SECTIONS);
  const [editMode, setEditMode] = useState(false);
  // Drag state: "item:sectionIdx:itemIdx" or "section:sectionIdx"
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    setSections(getSavedSections());
  }, []);

  function updateSections(next: NavSection[]) {
    setSections(next);
    saveSections(next);
  }

  // Item drag within and across sections
  function onItemDragStart(e: React.DragEvent, sIdx: number, iIdx: number) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `item:${sIdx}:${iIdx}`);
    setDragId(`item:${sIdx}:${iIdx}`);
  }

  function onItemDragOver(e: React.DragEvent, sIdx: number, iIdx: number) {
    if (!dragId?.startsWith("item:")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(`item:${sIdx}:${iIdx}`);
  }

  function onItemDrop(e: React.DragEvent, toSIdx: number, toIIdx: number) {
    e.preventDefault();
    if (!dragId?.startsWith("item:")) { clearDrag(); return; }
    const [, fromSStr, fromIStr] = dragId.split(":");
    const fromS = Number(fromSStr), fromI = Number(fromIStr);
    if (fromS === toSIdx && fromI === toIIdx) { clearDrag(); return; }

    const next = sections.map((s) => ({ ...s, items: [...s.items] }));
    const [moved] = next[fromS].items.splice(fromI, 1);
    // Adjust target index if same section and source was before target
    const adjustedIdx = fromS === toSIdx && fromI < toIIdx ? toIIdx - 1 : toIIdx;
    next[toSIdx].items.splice(adjustedIdx, 0, moved);
    // Remove empty sections
    const cleaned = next.filter((s) => s.items.length > 0);
    updateSections(cleaned);
    clearDrag();
  }

  // Section drag
  function onSectionDragStart(e: React.DragEvent, sIdx: number) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `section:${sIdx}`);
    setDragId(`section:${sIdx}`);
  }

  function onSectionDragOver(e: React.DragEvent, sIdx: number) {
    if (!dragId?.startsWith("section:")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(`section:${sIdx}`);
  }

  function onSectionDrop(e: React.DragEvent, toSIdx: number) {
    e.preventDefault();
    if (!dragId?.startsWith("section:")) { clearDrag(); return; }
    const fromS = Number(dragId.split(":")[1]);
    if (fromS === toSIdx) { clearDrag(); return; }

    const next = [...sections];
    const [moved] = next.splice(fromS, 1);
    next.splice(toSIdx, 0, moved);
    updateSections(next);
    clearDrag();
  }

  function clearDrag() {
    setDragId(null);
    setDropTarget(null);
  }

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
        <span className="text-xl font-bold tracking-tight text-primary font-heading">Morangos</span>
        <span className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider mt-0.5">v{appVersion}</span>
      </div>
      <Separator />
      <nav className="flex-1 flex flex-col gap-0.5 p-3 overflow-y-auto">
        {sections.map((section, sIdx) => {
          const sectionItems = section.items
            .map((href) => navItemMap.get(href))
            .filter(Boolean) as typeof navItems;
          if (sectionItems.length === 0) return null;

          const isSectionDragging = dragId === `section:${sIdx}`;
          const isSectionDropTarget = dropTarget === `section:${sIdx}` && dragId?.startsWith("section:") && dragId !== `section:${sIdx}`;

          return (
            <div
              key={section.label}
              className={`${sIdx > 0 ? "mt-3" : ""} ${isSectionDragging ? "opacity-50" : ""} relative`}
              onDragOver={(e) => {
                // Allow both section and item drops inside section containers
                if (dragId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
                if (dragId?.startsWith("section:")) setDropTarget(`section:${sIdx}`);
              }}
              onDrop={(e) => { if (dragId?.startsWith("section:")) { e.preventDefault(); onSectionDrop(e, sIdx); } }}
              onDragEnd={clearDrag}
            >
              {isSectionDropTarget && (
                <div className="absolute -top-1.5 left-2 right-2 h-[3px] rounded-full bg-primary z-10" />
              )}
              {/* Section header — draggable for section reorder */}
              <div
                draggable={editMode}
                onDragStart={(e) => { if (editMode) { e.stopPropagation(); onSectionDragStart(e, sIdx); } }}
                className={`flex items-center gap-1.5 px-3 pb-1.5 ${editMode ? "cursor-grab active:cursor-grabbing" : ""}`}
              >
                {editMode && (
                  <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                )}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                  {section.label}
                </p>
              </div>
              {sectionItems.map((item, iIdx) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                const isHighlight = (item as { highlight?: boolean }).highlight;
                const itemDragId = `item:${sIdx}:${iIdx}`;
                const isItemDragging = dragId === itemDragId;
                const isItemDropTarget = dropTarget === itemDragId && dragId?.startsWith("item:") && dragId !== itemDragId;

                return (
                  <div
                    key={item.href}
                    draggable={editMode}
                    onDragStart={(e) => { if (editMode) { e.stopPropagation(); onItemDragStart(e, sIdx, iIdx); } }}
                    onDragOver={(e) => {
                      if (dragId?.startsWith("item:")) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        setDropTarget(itemDragId);
                      }
                    }}
                    onDrop={(e) => {
                      if (dragId?.startsWith("item:")) {
                        e.preventDefault();
                        e.stopPropagation();
                        onItemDrop(e, sIdx, iIdx);
                      }
                    }}
                    onDragEnd={clearDrag}
                    className={`relative ${isItemDragging ? "opacity-50" : ""}`}
                  >
                    {isItemDropTarget && (
                      <div className="absolute -top-[1.5px] left-2 right-2 h-[3px] rounded-full bg-primary z-10" />
                    )}
                    <Link
                      href={item.href}
                      onClick={(e) => { if (editMode) { e.preventDefault(); return; } onNavigate?.(); }}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : isHighlight
                          ? "bg-primary/15 text-primary hover:bg-primary/25"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      } ${editMode ? "border border-border/50 cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      {editMode && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </div>
                );
              })}
            </div>
          );
        })}
        {isAdmin && (
          <div className="mt-3">
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
              Admin
            </p>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}>
                  <Icon className="h-4 w-4" />{item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <button
        type="button"
        onClick={() => setEditMode(!editMode)}
        className="flex items-center gap-2 mx-3 mb-1 px-3 py-1.5 text-xs font-medium text-muted-foreground/40 hover:text-muted-foreground transition-colors self-start rounded-lg"
      >
        {editMode ? (
          <><Check className="h-3 w-3" /> Concluir</>
        ) : (
          <><Pencil className="h-3 w-3" /> Editar Menu</>
        )}
      </button>
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

interface Notificacoes {
  pagamentosVencidos: { id: number; cliente: string; total: number; diasVencido: number; dataEntrega: string }[];
  contasVencendo: { id: number; fornecedor: string; valor: number; vencimento: string; diasParaVencer: number }[];
  contasVencidas: { id: number; fornecedor: string; valor: number; vencimento: string; diasVencido: number }[];
  contasProximasVencer: { id: number; fornecedor: string; valor: number; vencimento: string; diasParaVencer: number }[];
}

function NotificationBanners() {
  const [notifs, setNotifs] = useState<Notificacoes | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("notif-collapsed") === "1"; } catch { return false; }
  });

  useEffect(() => {
    fetch("/api/notificacoes")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setNotifs(data); })
      .catch(() => {});
  }, []);

  if (!notifs) return null;

  const { pagamentosVencidos, contasVencendo, contasVencidas, contasProximasVencer = [] } = notifs;
  const hasAny = pagamentosVencidos.length > 0 || contasVencendo.length > 0 || contasVencidas.length > 0 || contasProximasVencer.length > 0;
  if (!hasAny) return null;

  const items: { href: string; label: string; color: string; iconColor: string; icon: ReactNode }[] = [];

  if (pagamentosVencidos.length > 0)
    items.push({
      href: "/pedidos?situacaoPagamento=Pendente",
      label: `${pagamentosVencidos.length} pedido${pagamentosVencidos.length > 1 ? "s" : ""} sem pagamento`,
      color: "text-amber-300",
      iconColor: "text-amber-400",
      icon: <DollarSign className="size-3.5 shrink-0" />,
    });
  if (contasVencendo.length > 0)
    items.push({
      href: "/contas",
      label: `${contasVencendo.length} conta${contasVencendo.length > 1 ? "s" : ""} vence${contasVencendo.length > 1 ? "m" : ""} hoje`,
      color: "text-yellow-300",
      iconColor: "text-yellow-400",
      icon: <AlertTriangle className="size-3.5 shrink-0" />,
    });
  if (contasProximasVencer.length > 0)
    items.push({
      href: "/contas",
      label: `${contasProximasVencer.length} conta${contasProximasVencer.length > 1 ? "s" : ""} vence${contasProximasVencer.length > 1 ? "m" : ""} em 5 dias`,
      color: "text-blue-300",
      iconColor: "text-blue-400",
      icon: <AlertTriangle className="size-3.5 shrink-0" />,
    });
  if (contasVencidas.length > 0)
    items.push({
      href: "/contas",
      label: `${contasVencidas.length} conta${contasVencidas.length > 1 ? "s" : ""} vencida${contasVencidas.length > 1 ? "s" : ""}`,
      color: "text-red-300",
      iconColor: "text-red-400",
      icon: <AlertTriangle className="size-3.5 shrink-0" />,
    });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("notif-collapsed", next ? "1" : "0"); } catch {}
  }

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 mb-4 text-xs text-amber-400/80 hover:text-amber-300 transition-colors"
      >
        <Bell className="size-3.5" />
        <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{items.length}</span>
        <span>{items.length} {items.length === 1 ? "alerta" : "alertas"}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-1.5 mb-4">
      {items.map((item, i) => (
        <Link key={i} href={item.href} className={`flex items-center gap-1.5 text-xs hover:underline ${item.color}`}>
          <span className={item.iconColor}>{item.icon}</span>
          {item.label}
        </Link>
      ))}
      <button onClick={toggle} className="ml-auto text-muted-foreground/50 hover:text-muted-foreground transition-colors">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const noShellPages = ["/login", "/setup", "/entrega"];
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
          <div className="p-4 md:p-6">
            <NotificationBanners />
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable} ${dmSans.variable}`}>
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
