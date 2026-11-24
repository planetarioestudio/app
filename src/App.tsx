import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  auth,
  configured,
  googleProvider,
  ownerEmail,
  requireDb,
} from "./lib/firebase";
import {
  emptyAdminData,
  getAccess,
  initializeIdentity,
  watchAdmin,
} from "./lib/data";
import { errorMessage } from "./lib/utils";
import type { AdminData, ClientAccess } from "./lib/types";
import { Button } from "./components";
import { Dashboard } from "./pages/Dashboard";
import { ClientsPage, ClientDetail } from "./pages/Clients";
import { ProjectsPage, ProjectDetail } from "./pages/Projects";
import { AgendaPage } from "./pages/Agenda";
import {
  AnamnesesPage,
  ClientAnamnesePage,
  PublicAnamnese,
} from "./pages/Anamneses";
import { QuotesPage, QuoteDetail } from "./pages/Quotes";
import { FinancePage } from "./pages/Finance";
import { StockPage } from "./pages/Stock";
import { SettingsPage } from "./pages/Settings";
import { ClientPortalPage, RegistrationPage } from "./pages/ClientPortal";

const nav = [
  ["/", "Visão geral"],
  ["/agenda", "Agenda"],
  ["/clientes", "Clientes"],
  ["/projetos", "Projetos"],
  ["/anamneses", "Anamneses"],
  ["/orcamentos", "Orçamentos"],
  ["/financeiro", "Financeiro"],
  ["/estoque", "Estoque"],
];

function useRoute() {
  const [route, setRoute] = useState(() =>
    decodeURI(location.hash.slice(1) || "/"),
  );
  useEffect(() => {
    const update = () => setRoute(decodeURI(location.hash.slice(1) || "/"));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"owner" | "client" | null>(null);
  const [access, setAccess] = useState<ClientAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<AdminData>(emptyAdminData);
  const [adminReady, setAdminReady] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem("planetario-theme") || "light",
  );
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("planetario-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (current) => {
      setLoading(true);
      setUser(current);
      setRole(null);
      setAccess(null);
      setError("");
      if (!current) {
        setLoading(false);
        return;
      }
      try {
        const nextRole = await initializeIdentity(current);
        setRole(nextRole);
        if (nextRole === "client") setAccess(await getAccess(current.uid));
      } catch (e) {
        setError(errorMessage(e));
      }
      setLoading(false);
    });
  }, []);
  useEffect(() => {
    if (role !== "owner") return;
    setAdminReady(false);
    return watchAdmin(
      (next) => {
        setData(next);
        setAdminReady(true);
      },
      (e) => setError(errorMessage(e)),
    );
  }, [role]);
  useEffect(() => {
    if (role !== "client" || !user) return;
    return onSnapshot(
      doc(requireDb(), "clientAccess", user.uid),
      (snap) =>
        setAccess(
          snap.exists()
            ? ({ id: snap.id, ...snap.data() } as ClientAccess)
            : null,
        ),
      (err) => setError(errorMessage(err)),
    );
  }, [role, user]);

  async function login() {
    if (!auth) return;
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (auth) await signOut(auth);
    location.hash = "#/login";
  }
  function toggleTheme() {
    setTheme(theme === "light" ? "dark" : "light");
  }

  if (!configured)
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <span className="brand-symbol">✳</span>
          <h1>Planetário Estúdio</h1>
          <p>
            A base do aplicativo está pronta. Configure o Firebase em{" "}
            <code>.env.local</code> para começar no localhost.
          </p>
          <p>
            Use <code>.env.example</code> como referência.
          </p>
        </div>
      </div>
    );
  if (loading)
    return (
      <div className="loading-screen">Preparando o Planetário Estúdio…</div>
    );
  if (!user || !role)
    return (
      <div className="login-screen">
        <div className="login-art">
          <span className="brand-symbol">✳</span>
          <p>
            Planetário
            <br />
            Estúdio
          </p>
          <span>Organização para criar com calma.</span>
        </div>
        <div className="login-card">
          <span className="eyebrow">BEM-VINDO</span>
          <h1>Entre com sua conta Google</h1>
          <p>
            Entre para administrar o estúdio ou fazer seu cadastro de cliente,
            responder à anamnese e acompanhar seus projetos.
          </p>
          <Button onClick={login} disabled={busy}>
            {busy ? "Entrando…" : "Continuar com Google"}
          </Button>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <small>Conta proprietária prevista: {ownerEmail}</small>
        </div>
      </div>
    );

  if (role === "client")
    return (
      <div className="client-shell">
        <header>
          <a href="#/cliente" className="brand">
            <span className="brand-symbol">✳</span>
            <span>
              Planetário <b>Estúdio</b>
            </span>
          </a>
          <div className="header-actions">
            <span className="account-label">{user.email}</span>
            <Button variant="quiet" onClick={toggleTheme}>
              Tema
            </Button>
            <Button variant="quiet" onClick={logout}>
              Sair
            </Button>
          </div>
        </header>
        <main>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {access && !access.active ? (
            <div className="client-welcome">
              <h1>Acesso revogado</h1>
              <p>
                Entre em contato com o estúdio para esclarecer seu cadastro.
              </p>
            </div>
          ) : !access ? (
            <RegistrationPage
              user={user}
              onRegistered={setAccess}
              returnTo={route.startsWith("/anamnese/") ? route : undefined}
            />
          ) : route.startsWith("/anamnese/") ? (
            <PublicAnamnese
              requestId={route.split("/")[2] || ""}
              user={user}
              access={access}
              onAccessChange={setAccess}
            />
          ) : (
            <ClientPortalPage user={user} access={access} route={route} />
          )}
        </main>
      </div>
    );

  if (!adminReady)
    return (
      <div className="loading-screen">
        Carregando os registros do estúdio…
        {error && <p className="notice error">{error}</p>}
      </div>
    );
  let page;
  const parts = route.split("/").filter(Boolean);
  if (route === "/" || route === "/login") page = <Dashboard data={data} />;
  else if (parts[0] === "agenda") page = <AgendaPage data={data} />;
  else if (parts[0] === "clientes" && parts[1] && parts[2] === "anamneses")
    page = (
      <ClientAnamnesePage clientId={parts[1]} data={data} ownerUid={user.uid} />
    );
  else if (parts[0] === "clientes" && parts[1])
    page = <ClientDetail clientId={parts[1]} data={data} />;
  else if (parts[0] === "clientes") page = <ClientsPage data={data} />;
  else if (parts[0] === "projetos" && parts[1])
    page = <ProjectDetail projectId={parts[1]} data={data} />;
  else if (parts[0] === "projetos") page = <ProjectsPage data={data} />;
  else if (parts[0] === "anamneses")
    page = <AnamnesesPage data={data} ownerUid={user.uid} />;
  else if (parts[0] === "orcamentos" && parts[1])
    page = <QuoteDetail quoteId={parts[1]} data={data} />;
  else if (parts[0] === "orcamentos") page = <QuotesPage data={data} />;
  else if (parts[0] === "financeiro") page = <FinancePage data={data} />;
  else if (parts[0] === "estoque") page = <StockPage data={data} />;
  else if (parts[0] === "configuracoes")
    page = (
      <SettingsPage data={data} user={user} theme={theme} setTheme={setTheme} />
    );
  else
    page = (
      <div className="panel">
        <h1>Página não encontrada</h1>
        <a href="#/">Voltar ao início</a>
      </div>
    );

  return (
    <div className="app-shell">
      <aside className={mobileMenu ? "sidebar open" : "sidebar"}>
        <a className="brand" href="#/" onClick={() => setMobileMenu(false)}>
          <span className="brand-symbol">✳</span>
          <span>
            Planetário <b>Estúdio</b>
          </span>
        </a>
        <span className="nav-caption">MENU PRINCIPAL</span>
        <nav aria-label="Navegação principal">
          {nav.map(([path, label]) => (
            <a
              key={path}
              href={`#${path}`}
              className={
                route === path || (path !== "/" && route.startsWith(`${path}/`))
                  ? "active"
                  : ""
              }
              onClick={() => setMobileMenu(false)}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            href="#/configuracoes"
            className={route === "/configuracoes" ? "active" : ""}
            onClick={() => setMobileMenu(false)}
          >
            Configurações
          </a>
          <span>Uso pessoal · dados no Firebase</span>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            className="menu-toggle"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <div className="topbar-context">
            Planetário Estúdio <span> / </span>{" "}
            {nav.find(([path]) => route === path)?.[1] || "Atendimento"}
          </div>
          <div className="header-actions">
            <span className="account-label">{user.email}</span>
            <Button variant="quiet" onClick={toggleTheme}>
              {theme === "light" ? "Modo escuro" : "Modo claro"}
            </Button>
            <Button variant="quiet" onClick={logout}>
              Sair
            </Button>
          </div>
        </header>
        <main className="content">
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {page}
        </main>
      </div>
    </div>
  );
}
