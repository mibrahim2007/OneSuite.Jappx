import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { permissions, roles } from "./schema";
import { PERMISSION_CATALOG } from "./rbac-catalog";

async function seed() {
  if (!process.env.DIRECT_DATABASE_URL) {
    throw new Error("DIRECT_DATABASE_URL is required. Copy .env.example to .env.local and fill it in.");
  }

  const client = postgres(process.env.DIRECT_DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log("Seeding permissions...");
  await db
    .insert(permissions)
    .values(
      PERMISSION_CATALOG.map(({ code, module, resource, action, description }) => ({
        code,
        module,
        resource,
        action,
        description,
      }))
    )
    .onConflictDoNothing({ target: permissions.code });
  console.log(`  permissions: done (${PERMISSION_CATALOG.length} catalog entries)`);

  console.log("Seeding system roles...");
  await db
    .insert(roles)
    .values([
      { name: "Super Admin",            description: "Full platform access including tenant management", isSystem: true },
      { name: "Tenant Admin",           description: "Full administrative access for the organization",  isSystem: true },
      { name: "Accountant",             description: "Full access to accounts module",                   isSystem: true },
      { name: "Store Officer",          description: "Full access to SCM/inventory module",              isSystem: true },
      { name: "Maintenance Supervisor", description: "Full access to R&M module",                        isSystem: true },
      { name: "Fleet Manager",          description: "Full access to fleet module",                      isSystem: true },
      { name: "Sales Rep",              description: "Full access to CRM module",                        isSystem: true },
      { name: "HR Manager",             description: "Full access to HRM module",                        isSystem: true },
      { name: "Employee (ESS)",         description: "Self-service: leave, attendance, payslips",        isSystem: true },
      { name: "Read-Only Auditor",      description: "Read-only access across all modules",              isSystem: true },
    ])
    .onConflictDoNothing();
  console.log("  roles: done");

  console.log("Seeding role_permissions...");

  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
    WHERE r.name = 'Super Admin' AND r.tenant_id IS NULL
    ON CONFLICT DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
    WHERE r.name = 'Tenant Admin' AND r.tenant_id IS NULL
      AND p.module != 'platform'
    ON CONFLICT DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
    WHERE r.name = 'Accountant' AND r.tenant_id IS NULL
      AND (p.module = 'accounts' OR p.code IN ('scm:vendor:view','scm:item:view','admin:settings:view','admin:audit_log:view'))
    ON CONFLICT DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
    WHERE r.name = 'Store Officer' AND r.tenant_id IS NULL
      AND (p.module = 'scm' OR p.code IN ('accounts:bill:view','accounts:invoice:view','admin:settings:view'))
    ON CONFLICT DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
    WHERE r.name = 'Maintenance Supervisor' AND r.tenant_id IS NULL
      AND (p.module = 'rm' OR p.code IN ('scm:inventory:view','scm:item:view','admin:settings:view'))
    ON CONFLICT DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
    WHERE r.name = 'Fleet Manager' AND r.tenant_id IS NULL
      AND (p.module = 'fleet' OR p.code IN ('rm:workorder:view','rm:workorder:create','admin:settings:view'))
    ON CONFLICT DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
    WHERE r.name = 'Sales Rep' AND r.tenant_id IS NULL
      AND (p.module = 'crm' OR p.code IN ('accounts:invoice:view','scm:item:view','admin:settings:view'))
    ON CONFLICT DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
    WHERE r.name = 'HR Manager' AND r.tenant_id IS NULL
      AND (p.module = 'hrm' OR p.code IN ('admin:user:view','admin:settings:view'))
    ON CONFLICT DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
    WHERE r.name = 'Employee (ESS)' AND r.tenant_id IS NULL
      AND p.code IN ('hrm:leave:view','hrm:leave:request','hrm:payslip:view','hrm:attendance:view')
    ON CONFLICT DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
    WHERE r.name = 'Read-Only Auditor' AND r.tenant_id IS NULL
      AND (p.action = 'view' OR p.code = 'admin:audit_log:view')
    ON CONFLICT DO NOTHING
  `);

  console.log("  role_permissions: done");

  await client.end();
  console.log("\nSeed complete.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
