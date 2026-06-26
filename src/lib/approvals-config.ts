export const ENTITY_APPROVE_PERM: Record<string, string> = {
  requisition: "scm:requisition:approve",
  purchase_order: "scm:po:approve",
};

export const ENTITY_REVALIDATE: Record<string, string[]> = {
  requisition: ["/app/procurement/requisitions", "/app/approvals"],
  purchase_order: ["/app/procurement/purchase-orders", "/app/approvals"],
};
