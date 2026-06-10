import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@bazaarprinting.com";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Super Admin";

/** Create Supabase Auth user and matching SUPER_ADMIN app User record */
async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const tempPassword =
    process.env.ADMIN_PASSWORD ?? randomBytes(12).toString("base64url") + "A1!";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existingUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existingUser) {
    console.log(`Admin already exists: ${ADMIN_EMAIL}`);
    console.log("Use your existing password to log in.");
    return;
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: ADMIN_NAME },
  });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      const { data: listData } = await supabase.auth.admin.listUsers();
      const authUser = listData.users.find((u) => u.email === ADMIN_EMAIL);
      if (!authUser) throw authError;

      await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          role: "SUPER_ADMIN",
          mustChangePassword: false,
        },
      });

      console.log(`Linked existing Supabase user to SUPER_ADMIN: ${ADMIN_EMAIL}`);
      return;
    }
    throw authError;
  }

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "SUPER_ADMIN",
      mustChangePassword: !process.env.ADMIN_PASSWORD,
    },
  });

  console.log("\n✅ Super Admin created successfully\n");
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  if (process.env.ADMIN_PASSWORD) {
    console.log("   Password: (as provided)");
  } else {
    console.log(`   Password: ${tempPassword}`);
  }
  console.log("\n   Log in at: http://localhost:3000/login\n");
}

main()
  .catch((err) => {
    console.error("Failed to create admin:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
