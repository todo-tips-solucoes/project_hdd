"use client";

import { getMe, loginUrl, logout } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

function LoginScreen() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold">HDD · Painel</h1>
        <p className="mt-1 text-sm text-muted">
          Orquestração autônoma — operação remota.
        </p>
        <Button
          className="mt-5 w-full"
          onClick={() => {
            window.location.href = loginUrl();
          }}
        >
          Entrar com GitHub
        </Button>
      </Card>
    </div>
  );
}

function NavBar({ login, avatar }: { login: string; avatar: string | null }) {
  const qc = useQueryClient();
  const out = useMutation({
    mutationFn: logout,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
  return (
    <header className="border-b border-border bg-surface/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <nav className="flex items-center gap-5">
          <span className="font-semibold tracking-tight">HDD · Painel</span>
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            Ondas
          </Link>
          <Link href="/gates" className="text-sm text-muted hover:text-foreground">
            Gates
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-6 w-6 rounded-full" />
          ) : null}
          <span className="text-muted">{login}</span>
          <Button variant="ghost" className="px-2 py-1" onClick={() => out.mutate()}>
            <LogOut size={14} />
          </Button>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        Carregando…
      </div>
    );
  }
  if (isError || !user) return <LoginScreen />;

  return (
    <div className="min-h-screen">
      <NavBar login={user.login} avatar={user.avatar_url ?? null} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
