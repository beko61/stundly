import { adminClient } from "@/lib/superadmin/auth";
import { loadSuperadminUsers } from "@/lib/superadmin/data";
import type { Segment } from "@/lib/superadmin/metrics";
import UsersTable from "./UsersTable";

export const dynamic = "force-dynamic";

const SEGMENTS: Segment[] = ["all", "active7", "never", "inactive", "unconfirmed", "deletion"];

export default async function SuperAdminUsersPage({ searchParams }: { searchParams: Promise<{ seg?: string }> }) {
  const { seg } = await searchParams;
  const users = await loadSuperadminUsers(adminClient());
  const initialSegment = SEGMENTS.includes(seg as Segment) ? (seg as Segment) : "all";

  return (
    <div>
      <h1 className="sa-title">Kullanıcılar</h1>
      <p className="sa-sub">{users.length} hesap · satıra dokun → detay ve işlemler</p>
      <UsersTable initialUsers={users} initialSegment={initialSegment} />
    </div>
  );
}
