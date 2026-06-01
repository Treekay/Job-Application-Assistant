import { useState } from "react";
import { Shield } from "lucide-react";
import { fetchAdminUsers } from "../api/workflowApi";
import type { WorkflowUser } from "../types/workflow";

export function AdminView({ user }: { user: WorkflowUser }) {
  const [users, setUsers] = useState<WorkflowUser[]>([]);
  const [error, setError] = useState("");

  async function loadUsers() {
    try {
      setUsers(await fetchAdminUsers());
    } catch (adminError) {
      setError(adminError instanceof Error ? adminError.message : "Admin request failed");
    }
  }

  return (
    <section className="workflowPanel">
      <div className="panelTitle"><Shield size={18} /><h2>Admin</h2><button type="button" onClick={loadUsers}>Load users</button></div>
      <p className="workflowMuted">Current role: {user.role}. Admin endpoint is role protected.</p>
      {error ? <p className="workflowError">{error}</p> : null}
      {users.map((item) => <div className="deadlineRow" key={item.id}><strong>{item.displayName}</strong><span>{item.email} - {item.role}</span></div>)}
    </section>
  );
}
