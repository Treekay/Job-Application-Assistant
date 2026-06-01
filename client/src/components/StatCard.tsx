export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="workflowStat">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}
