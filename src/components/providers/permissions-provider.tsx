"use client";

import { createContext, useContext } from "react";

const PermissionsContext = createContext<string[]>([]);

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: string[];
  children: React.ReactNode;
}) {
  return (
    <PermissionsContext.Provider value={permissions}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): string[] {
  return useContext(PermissionsContext);
}

export function useHasPermission(permission: string): boolean {
  return useContext(PermissionsContext).includes(permission);
}
